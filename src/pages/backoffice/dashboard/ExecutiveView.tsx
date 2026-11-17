import { useMemo } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import type { PickupPost } from '../../../types/api';
import { formatPrice } from '../../../utils/helpers';
import { ChartCard, FunnelChart, KpiTile, RankedBars, SplitBreakdown, TimeSeriesChart, type RankedRow } from './charts';
import { changeDelta, countLabel, formatCount, formatPercent, pointsDelta } from './format';
import {
  buildBuckets,
  buildFunnel,
  categoryRanking,
  deliverySplit,
  GRANULARITY_LABEL,
  inRange,
  paymentMethodSplit,
  PERIOD_OPTIONS,
  periodRange,
  productRanking,
  storeRanking,
  summarise,
  type PeriodId,
  type PreparedOrder,
  type ProductInfo,
} from './metrics';

const TOP_PRODUCTS = 10;

const UNIT_LABEL = { hour: 'Hora', day: 'Dia', week: 'Semana' } as const;

interface ExecutiveViewProps {
  orders: PreparedOrder[];
  now: number;
  period: PeriodId;
  onPeriodChange: (period: PeriodId) => void;
  products: Map<string, ProductInfo>;
  productsLoading: boolean;
  productsError: boolean;
  onRetryProducts: () => void;
  pickupPosts: PickupPost[];
}

export function ExecutiveView({
  orders,
  now,
  period,
  onPeriodChange,
  products,
  productsLoading,
  productsError,
  onRetryProducts,
  pickupPosts,
}: ExecutiveViewProps) {
  const range = useMemo(() => periodRange(period, now, orders), [period, now, orders]);
  const current = useMemo(() => inRange(orders, range), [orders, range]);
  const summary = useMemo(() => summarise(current), [current]);
  const previous = useMemo(() => (range.previous ? summarise(inRange(orders, range.previous)) : null), [orders, range]);
  const buckets = useMemo(() => buildBuckets(range, current, now), [range, current, now]);
  const methods = useMemo(() => paymentMethodSplit(current), [current]);
  const delivery = useMemo(() => deliverySplit(current), [current]);
  const funnel = useMemo(() => buildFunnel(current), [current]);

  const storeRows = useMemo<RankedRow[]>(
    () =>
      storeRanking(current, pickupPosts).map((row) => ({
        id: row.id,
        label: row.label,
        value: row.revenue,
        valueLabel: formatPrice(row.revenue),
        detail: `${countLabel(row.orders, 'encomenda', 'encomendas')} · ${countLabel(row.sales, 'paga', 'pagas')}`,
      })),
    [current, pickupPosts],
  );

  const categoryRows = useMemo<RankedRow[]>(
    () =>
      categoryRanking(current, products).map((row) => ({
        id: row.id,
        label: row.label,
        value: row.revenue,
        valueLabel: formatPrice(row.revenue),
        detail: countLabel(row.units, 'unidade', 'unidades'),
      })),
    [current, products],
  );

  const productRows = useMemo(() => productRanking(current, products), [current, products]);

  const byRevenue = useMemo<RankedRow[]>(
    () =>
      [...productRows]
        .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.label.localeCompare(b.label, 'pt'))
        .slice(0, TOP_PRODUCTS)
        .map((row) => ({
          id: row.id,
          label: row.label,
          value: row.revenue,
          valueLabel: formatPrice(row.revenue),
          detail: countLabel(row.units, 'unidade', 'unidades'),
        })),
    [productRows],
  );

  const byUnits = useMemo<RankedRow[]>(
    () =>
      [...productRows]
        .sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.label.localeCompare(b.label, 'pt'))
        .slice(0, TOP_PRODUCTS)
        .map((row) => ({
          id: row.id,
          label: row.label,
          value: row.units,
          valueLabel: countLabel(row.units, 'unidade', 'unidades'),
          detail: `${formatPrice(row.revenue)} · ${countLabel(row.orders, 'encomenda', 'encomendas')}`,
        })),
    [productRows],
  );

  const comparison = range.comparisonLabel;

  return (
    <div className="dash-view">
      <div className="dash-filters">
        <div className="dash-segmented" role="group" aria-label="Período">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === period}
              onClick={() => onPeriodChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="dash-filter-note">
          <CalendarDays size={15} aria-hidden="true" />
          Encomendas registadas {range.description}
          {comparison && <span className="dash-muted"> · comparação {comparison}</span>}
        </p>
      </div>

      <div className="dash-kpis">
        <KpiTile
          label="Receita confirmada"
          value={formatPrice(summary.revenue)}
          delta={previous && changeDelta(summary.revenue, previous.revenue)}
          comparison={comparison}
          hint={`${countLabel(summary.sales, 'venda paga', 'vendas pagas')}, sem as canceladas`}
        />
        <KpiTile
          label="Encomendas"
          value={formatCount(summary.orders)}
          delta={previous && changeDelta(summary.orders, previous.orders)}
          comparison={comparison}
          hint="Registadas, em qualquer estado"
        />
        <KpiTile
          label="Ticket médio"
          value={summary.avgTicket === null ? '—' : formatPrice(summary.avgTicket)}
          delta={previous && changeDelta(summary.avgTicket, previous.avgTicket)}
          comparison={comparison}
          hint="Receita confirmada por venda paga"
        />
        <KpiTile
          label="Taxa de pagamento"
          value={formatPercent(summary.paymentRate)}
          delta={previous && pointsDelta(summary.paymentRate, previous.paymentRate)}
          comparison={comparison}
          hint={`${formatCount(summary.paid)} pagos de ${countLabel(summary.settled, 'pagamento concluído', 'pagamentos concluídos')}`}
        />
        <KpiTile
          label="Taxa de cancelamento"
          value={formatPercent(summary.cancelRate)}
          delta={previous && pointsDelta(summary.cancelRate, previous.cancelRate, false)}
          comparison={comparison}
          hint={`${countLabel(summary.cancelled, 'cancelada', 'canceladas')}, incluindo pagamentos expirados`}
        />
      </div>

      {summary.withoutPayment > 0 && (
        <p className="dash-notice">
          <Info size={16} aria-hidden="true" />
          {countLabel(summary.withoutPayment, 'encomenda deste período não tem', 'encomendas deste período não têm')} dados
          de pagamento (encomendas antigas): contam nas encomendas, mas não na receita confirmada nem na taxa de pagamento.
        </p>
      )}

      <ChartCard
        title={`Receita e encomendas ${GRANULARITY_LABEL[range.granularity]}`}
        subtitle="Receita das vendas pagas e não canceladas; encomendas em qualquer estado. Hora de Luanda."
        className="dash-section"
      >
        <TimeSeriesChart buckets={buckets} unitLabel={UNIT_LABEL[range.granularity]} />
      </ChartCard>

      <div className="dash-grid">
        <ChartCard title="Por método de pagamento" subtitle="A barra reparte as encomendas registadas no período.">
          <SplitBreakdown parts={methods} dimension="Método" />
        </ChartCard>
        <ChartCard title="Por tipo de entrega" subtitle="A barra reparte as encomendas registadas no período.">
          <SplitBreakdown parts={delivery} dimension="Entrega" />
        </ChartCard>
      </div>

      <div className="dash-grid">
        <ChartCard title="Por loja" subtitle="Receita confirmada por loja de levantamento ou de preparação.">
          <RankedBars rows={storeRows} emptyText="Sem lojas para mostrar." ariaLabel="Receita confirmada por loja" />
        </ChartCard>
        <ChartCard title="Por categoria" subtitle="Soma dos artigos das vendas confirmadas, sem a taxa de entrega.">
          {productsLoading ? (
            <p className="dash-empty-note">A carregar as categorias…</p>
          ) : productsError ? (
            <div className="dash-empty-note">
              <p>Não foi possível carregar os produtos para agrupar por categoria.</p>
              <button type="button" className="btn btn-outline btn-sm dash-retry" onClick={onRetryProducts}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <RankedBars
              rows={categoryRows}
              emptyText="Sem vendas confirmadas neste período."
              ariaLabel="Receita confirmada por categoria"
            />
          )}
        </ChartCard>
      </div>

      <div className="dash-grid">
        <ChartCard title="Produtos com mais receita" subtitle={`Os ${TOP_PRODUCTS} primeiros, nas vendas confirmadas.`}>
          <RankedBars
            rows={byRevenue}
            limit={TOP_PRODUCTS}
            emptyText="Sem vendas confirmadas neste período."
            ariaLabel="Produtos com mais receita"
          />
        </ChartCard>
        <ChartCard title="Produtos mais vendidos" subtitle={`Os ${TOP_PRODUCTS} primeiros em unidades, nas vendas confirmadas.`}>
          <RankedBars
            rows={byUnits}
            limit={TOP_PRODUCTS}
            emptyText="Sem vendas confirmadas neste período."
            ariaLabel="Produtos mais vendidos em unidades"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Funil das encomendas"
        subtitle="Registadas → pagas → em preparação → prontas → entregues, nas encomendas do período."
        className="dash-section"
      >
        <FunnelChart data={funnel} />
      </ChartCard>
    </div>
  );
}
