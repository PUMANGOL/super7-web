import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChartColumn, CircleX, Minus, Table2, TimerOff, TriangleAlert } from 'lucide-react';
import { formatPrice } from '../../../utils/helpers';
import { formatCompact, formatCount, formatPercent, type KpiDelta } from './format';
import { useElementWidth } from './hooks';
import type { Bucket, FunnelData, SplitPart } from './metrics';

/* ---------- Mosaico de indicador ---------- */

interface KpiTileProps {
  label: string;
  value: string;
  hint?: ReactNode;
  delta?: KpiDelta | null;
  comparison?: string | null;
}

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

export function KpiTile({ label, value, hint, delta, comparison }: KpiTileProps) {
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null;
  return (
    <div className="stat-card dash-kpi">
      <span className="dash-kpi-label">{label}</span>
      <span className="stat-value dash-kpi-value">{value}</span>
      {delta && DeltaIcon && (
        <span className={`dash-delta dash-delta--${delta.tone}`}>
          <DeltaIcon size={14} aria-hidden="true" />
          <strong>{delta.text}</strong>
          {comparison && <span className="dash-delta-context">{comparison}</span>}
        </span>
      )}
      {hint && <span className="dash-kpi-hint">{hint}</span>}
    </div>
  );
}

/* ---------- Cartão de gráfico ---------- */

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, actions, children, className }: ChartCardProps) {
  return (
    <section className={`dash-card${className ? ` ${className}` : ''}`}>
      <header className="dash-card-head">
        <div className="dash-card-heading">
          <h2 className="dash-card-title">{title}</h2>
          {subtitle && <p className="dash-card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="dash-card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/* ---------- Série temporal: receita e encomendas (dois painéis, o mesmo eixo X) ---------- */

const MARGIN_LEFT = 56;
const MARGIN_RIGHT = 12;
const TOP_PAD = 20;
const PLOT_HEIGHT = 112;
const X_AXIS_BAND = 24;
const MAX_BAR = 24;
const BAR_RADIUS = 4;

interface SeriesSpec {
  id: string;
  title: string;
  value: (bucket: Bucket) => number;
  axis: (value: number) => string;
  integer: boolean;
}

const SERIES: SeriesSpec[] = [
  { id: 'revenue', title: 'Receita confirmada (Kz)', value: (bucket) => bucket.revenue, axis: formatCompact, integer: false },
  { id: 'orders', title: 'Encomendas registadas', value: (bucket) => bucket.orders, axis: formatCount, integer: true },
];

/** Marcas do eixo Y: 0 e passos "redondos" até cobrir o máximo. */
function niceTicks(max: number, integer: boolean): number[] {
  if (max <= 0) return [0, integer ? 1 : 1000];
  const rough = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  let step = nice * magnitude;
  if (integer) step = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) {
    ticks.push(value);
    if (value >= max) break;
  }
  return ticks;
}

/** Coluna com o topo arredondado (4px) e a base recta, assente na linha de base. */
function columnPath(x: number, top: number, width: number, baseline: number): string {
  const height = baseline - top;
  if (height <= 0 || width <= 0) return '';
  const radius = Math.min(BAR_RADIUS, width / 2, height);
  return [
    `M${x},${baseline}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + width - radius}`,
    `Q${x + width},${top} ${x + width},${top + radius}`,
    `V${baseline}`,
    'Z',
  ].join(' ');
}

/** Índices dos rótulos do eixo X: os mais recentes primeiro, sem se sobreporem. */
function labelIndices(count: number, plotWidth: number, charWidth: number): number[] {
  if (count === 0) return [];
  const capacity = Math.max(2, Math.floor(plotWidth / Math.max(40, charWidth)));
  const step = Math.max(1, Math.ceil(count / capacity));
  const indices: number[] = [];
  for (let index = count - 1; index >= 0; index -= step) indices.push(index);
  return indices;
}

interface ColumnPanelProps {
  buckets: Bucket[];
  spec: SeriesSpec;
  width: number;
  hovered: number | null;
  showXAxis: boolean;
  xLabels: number[];
  onHover: (index: number) => void;
}

function ColumnPanel({ buckets, spec, width, hovered, showXAxis, xLabels, onHover }: ColumnPanelProps) {
  const values = buckets.map(spec.value);
  const max = Math.max(0, ...values);
  const ticks = niceTicks(max, spec.integer);
  const top = ticks[ticks.length - 1] || 1;
  const plotWidth = Math.max(0, width - MARGIN_LEFT - MARGIN_RIGHT);
  const band = buckets.length > 0 ? plotWidth / buckets.length : 0;
  const gapped = Math.max(1, band - 2);
  const barWidth = Math.min(MAX_BAR, Math.max(1, Math.min(gapped, band * 0.72)));
  const baseline = TOP_PAD + PLOT_HEIGHT;
  const height = baseline + (showXAxis ? X_AXIS_BAND : 8);
  const yOf = (value: number) => baseline - (value / top) * PLOT_HEIGHT;
  const centreOf = (index: number) => MARGIN_LEFT + (index + 0.5) * band;
  const peakIndex = max > 0 ? values.lastIndexOf(max) : -1;

  const anchorFor = (index: number): 'start' | 'middle' | 'end' => {
    const x = centreOf(index);
    if (x - MARGIN_LEFT < 24) return 'start';
    if (width - MARGIN_RIGHT - x < 24) return 'end';
    return 'middle';
  };
  const anchorX = (index: number, anchor: 'start' | 'middle' | 'end') =>
    anchor === 'start' ? centreOf(index) - barWidth / 2 : anchor === 'end' ? centreOf(index) + barWidth / 2 : centreOf(index);

  return (
    <div className="dash-ts-panel">
      <div className="dash-ts-title">{spec.title}</div>
      <svg width={width} height={height} className="dash-ts-svg" aria-hidden="true">
        {ticks.map((tick) => {
          const y = Math.round(yOf(tick)) + 0.5;
          return (
            <g key={tick}>
              {tick > 0 && <line x1={MARGIN_LEFT} x2={width - MARGIN_RIGHT} y1={y} y2={y} className="dash-grid-line" />}
              <text x={MARGIN_LEFT - 8} y={y} dy="0.32em" textAnchor="end" className="dash-axis-text">
                {spec.axis(tick)}
              </text>
            </g>
          );
        })}

        {hovered !== null && (
          <rect x={MARGIN_LEFT + hovered * band} y={TOP_PAD - 8} width={band} height={PLOT_HEIGHT + 8} className="dash-ts-hoverband" />
        )}

        {values.map((value, index) =>
          value > 0 ? (
            <path
              key={buckets[index].key}
              d={columnPath(centreOf(index) - barWidth / 2, yOf(value), barWidth, baseline)}
              className={`dash-ts-bar${hovered !== null && hovered !== index ? ' is-dim' : ''}`}
            />
          ) : null,
        )}

        <line x1={MARGIN_LEFT} x2={width - MARGIN_RIGHT} y1={baseline + 0.5} y2={baseline + 0.5} className="dash-axis-line" />

        {hovered === null && peakIndex >= 0 && (
          <text
            x={anchorX(peakIndex, anchorFor(peakIndex))}
            y={yOf(max) - 6}
            textAnchor={anchorFor(peakIndex)}
            className="dash-ts-peak"
          >
            {spec.axis(max)}
          </text>
        )}

        {showXAxis &&
          xLabels.map((index) => (
            <text
              key={buckets[index].key}
              x={anchorX(index, anchorFor(index))}
              y={baseline + 16}
              textAnchor={anchorFor(index)}
              className={`dash-axis-text${hovered === index ? ' is-active' : ''}`}
            >
              {buckets[index].label}
            </text>
          ))}

        {buckets.map((bucket, index) => (
          <rect
            key={bucket.key}
            x={MARGIN_LEFT + index * band}
            y={0}
            width={band}
            height={height}
            fill="transparent"
            onPointerEnter={() => onHover(index)}
            onPointerDown={() => onHover(index)}
          />
        ))}
      </svg>
    </div>
  );
}

interface TimeSeriesChartProps {
  buckets: Bucket[];
  /** "Dia", "Hora", "Semana": cabeçalho da primeira coluna da tabela. */
  unitLabel: string;
}

export function TimeSeriesChart({ buckets, unitLabel }: TimeSeriesChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const plotWidth = Math.max(0, width - MARGIN_LEFT - MARGIN_RIGHT);
  const longestLabel = buckets.reduce((max, bucket) => Math.max(max, bucket.label.length), 0);
  const xLabels = labelIndices(buckets.length, plotWidth, longestLabel * 7 + 16);
  const active = hovered !== null && hovered < buckets.length ? hovered : null;
  const activeBucket = active !== null ? buckets[active] : null;
  const hasData = buckets.some((bucket) => bucket.orders > 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (buckets.length === 0) return;
    const last = buckets.length - 1;
    const current = active ?? last;
    const next =
      event.key === 'ArrowLeft' ? Math.max(0, current - 1)
      : event.key === 'ArrowRight' ? Math.min(last, current + 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setHovered(next);
  };

  const band = buckets.length > 0 ? plotWidth / buckets.length : 0;
  const tooltipStyle = ((): CSSProperties | undefined => {
    if (active === null) return undefined;
    const centre = MARGIN_LEFT + (active + 0.5) * band;
    const offset = band / 2 + 10;
    return centre + offset + 220 <= width
      ? { left: centre + offset }
      : { left: centre - offset, transform: 'translateX(-100%)' };
  })();

  const toggle = (
    <button type="button" className="dash-link-button" onClick={() => setShowTable((value) => !value)}>
      {showTable ? <ChartColumn size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
      {showTable ? 'Ver gráfico' : 'Ver tabela'}
    </button>
  );

  if (!hasData) {
    return <p className="dash-empty-note">Sem encomendas neste período.</p>;
  }

  return (
    <div className="dash-ts-wrap">
      <div className="dash-ts-toolbar">{toggle}</div>
      {showTable ? (
        <div className="dash-table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">{unitLabel}</th>
                <th scope="col" className="num">Encomendas</th>
                <th scope="col" className="num">Vendas pagas</th>
                <th scope="col" className="num">Receita confirmada</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((bucket) => (
                <tr key={bucket.key}>
                  <th scope="row">{bucket.longLabel}</th>
                  <td className="num">{formatCount(bucket.orders)}</td>
                  <td className="num">{formatCount(bucket.sales)}</td>
                  <td className="num">{formatPrice(bucket.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="dash-ts"
          tabIndex={0}
          role="group"
          aria-label="Receita confirmada e encomendas registadas ao longo do período. Use as setas para percorrer; a tabela tem os mesmos valores."
          onKeyDown={onKeyDown}
          onFocus={() => setHovered((value) => value ?? buckets.length - 1)}
          onBlur={() => setHovered(null)}
          onPointerLeave={() => setHovered(null)}
        >
          {width > 0 &&
            SERIES.map((spec, index) => (
              <ColumnPanel
                key={spec.id}
                buckets={buckets}
                spec={spec}
                width={width}
                hovered={active}
                showXAxis={index === SERIES.length - 1}
                xLabels={xLabels}
                onHover={setHovered}
              />
            ))}
          {activeBucket && (
            <div className="dash-tooltip" style={tooltipStyle} role="status">
              <div className="dash-tooltip-title">{activeBucket.longLabel}</div>
              <div className="dash-tooltip-row">
                <strong>{formatPrice(activeBucket.revenue)}</strong>
                <span>receita confirmada</span>
              </div>
              <div className="dash-tooltip-row">
                <strong>{formatCount(activeBucket.orders)}</strong>
                <span>encomendas registadas</span>
              </div>
              <div className="dash-tooltip-row">
                <strong>{formatCount(activeBucket.sales)}</strong>
                <span>vendas pagas</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Barras ordenadas (lojas, categorias, produtos) ---------- */

export interface RankedRow {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
}

interface RankedBarsProps {
  rows: RankedRow[];
  emptyText: string;
  limit?: number;
  ariaLabel: string;
}

export function RankedBars({ rows, emptyText, limit = 8, ariaLabel }: RankedBarsProps) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return <p className="dash-empty-note">{emptyText}</p>;

  const max = rows.reduce((value, row) => Math.max(value, row.value), 0);
  const visible = expanded ? rows : rows.slice(0, limit);

  return (
    <>
      <ol className="dash-rank" aria-label={ariaLabel}>
        {visible.map((row) => (
          <li key={row.id} className="dash-rank-row">
            <span className="dash-rank-name">
              <span className="dash-rank-label" title={row.label}>
                {row.label}
              </span>
              {row.detail && <span className="dash-rank-detail">{row.detail}</span>}
            </span>
            <span className="dash-bar-track">
              <span
                className="dash-bar dash-fill--series-1"
                style={{ '--ratio': max > 0 ? row.value / max : 0 } as CSSProperties}
                data-zero={row.value <= 0 ? '' : undefined}
              />
              <span className="dash-bar-value">{row.valueLabel}</span>
            </span>
          </li>
        ))}
      </ol>
      {rows.length > limit && (
        <button type="button" className="dash-link-button dash-more" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Mostrar menos' : `Mostrar tudo (${rows.length})`}
        </button>
      )}
    </>
  );
}

/* ---------- Repartição: barra segmentada fina + tabela com as figuras ---------- */

interface SplitBreakdownProps {
  parts: SplitPart[];
  /** Cabeçalho da primeira coluna: "Método", "Entrega". */
  dimension: string;
}

export function SplitBreakdown({ parts, dimension }: SplitBreakdownProps) {
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((sum, part) => sum + part.orders, 0);
  if (total === 0) return <p className="dash-empty-note">Sem encomendas neste período.</p>;

  const description = parts
    .map((part) => `${part.label}: ${formatPercent(part.share)} (${formatCount(part.orders)})`)
    .join('; ');

  return (
    <div className="dash-split">
      <div className="dash-split-bar" role="img" aria-label={description}>
        {parts
          .filter((part) => part.orders > 0)
          .map((part) => (
            <span
              key={part.id}
              className={`dash-split-seg dash-fill--${part.colour}${active && active !== part.id ? ' is-dim' : ''}`}
              style={{ flexGrow: part.orders }}
              title={`${part.label}: ${formatPercent(part.share)}`}
              onPointerEnter={() => setActive(part.id)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
      </div>
      <div className="dash-table-scroll dash-table-scroll--plain">
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">{dimension}</th>
              <th scope="col" className="num">Encomendas</th>
              <th scope="col" className="num">Taxa de pagamento</th>
              <th scope="col" className="num">Receita confirmada</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr
                key={part.id}
                className={active === part.id ? 'is-active' : undefined}
                onPointerEnter={() => setActive(part.id)}
                onPointerLeave={() => setActive(null)}
              >
                <th scope="row">
                  <span className="dash-legend-item">
                    <span className={`dash-swatch dash-fill--${part.colour}`} aria-hidden="true" />
                    {part.label}
                  </span>
                </th>
                <td className="num" data-label="Encomendas">
                  {formatCount(part.orders)} <span className="dash-muted">· {formatPercent(part.share)}</span>
                </td>
                <td className="num" data-label="Taxa de pagamento">
                  {formatPercent(part.paymentRate)}
                </td>
                <td className="num" data-label="Receita confirmada">
                  {formatPrice(part.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Funil ---------- */

export function FunnelChart({ data }: { data: FunnelData }) {
  if (data.total === 0) return <p className="dash-empty-note">Sem encomendas neste período.</p>;
  const lostShare = (count: number) => formatPercent(data.total > 0 ? count / data.total : null);

  return (
    <>
      <ol className="dash-rank dash-funnel" aria-label="Funil das encomendas">
        {data.stages.map((stage, index) => (
          <li key={stage.id} className="dash-rank-row">
            <span className="dash-rank-name">
              <span className="dash-rank-label">{stage.label}</span>
              {stage.stepRate !== null && (
                <span className="dash-rank-detail">{formatPercent(stage.stepRate)} da etapa anterior</span>
              )}
            </span>
            <span className="dash-bar-track">
              <span
                className={`dash-bar dash-fill--ord-${index + 1}`}
                style={{ '--ratio': stage.share } as CSSProperties}
                data-zero={stage.count <= 0 ? '' : undefined}
              />
              <span className="dash-bar-value">
                {formatCount(stage.count)} <span className="dash-muted">· {formatPercent(stage.share)}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
      <ul className="dash-lost">
        <li>
          <CircleX size={16} className="dash-status-icon dash-status-icon--critical" aria-hidden="true" />
          <strong>{formatCount(data.cancelled)}</strong> canceladas
          <span className="dash-muted">({lostShare(data.cancelled)})</span>
        </li>
        <li>
          <TimerOff size={16} className="dash-status-icon dash-status-icon--serious" aria-hidden="true" />
          <strong>{formatCount(data.expired)}</strong> com pagamento expirado
        </li>
        <li>
          <TriangleAlert size={16} className="dash-status-icon dash-status-icon--serious" aria-hidden="true" />
          <strong>{formatCount(data.failed)}</strong> com pagamento falhado
        </li>
      </ul>
      <p className="dash-footnote">
        Cada etapa conta as encomendas que já lá chegaram; as percentagens são das encomendas registadas. Um pagamento
        expirado ou falhado cancela a encomenda, por isso também entra nas canceladas.
      </p>
    </>
  );
}
