import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  Boxes,
  CalendarClock,
  CircleCheck,
  CircleX,
  FileCheck,
  Landmark,
  PackageCheck,
  PackageOpen,
  PackageX,
  Timer,
  TimerOff,
  TriangleAlert,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { shortOrderId } from '../../../api/orders';
import type { Product } from '../../../catalog/types';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../../config/store';
import { orderStatusColors } from '../../../constants/orderStatus';
import { formatPrice } from '../../../utils/helpers';
import { countLabel, formatCount } from './format';
import { useNow } from './hooks';
import { buildStock, LOW_STOCK_LIMIT, type LostReason, type LostRow, type OpsData, type OpsRow } from './operations';
import { dayMonth, timeAgo, timeLeft } from './time';

const ORDERS_PATH = '/backoffice/encomendas';
const LIST_LIMIT = 6;

/* ---------- Linhas e listas ---------- */

interface OrderRowProps {
  row: OpsRow;
  now: number;
  meta?: ReactNode;
  /** Texto antes do "há X": "comprovativo", "paga". */
  agoPrefix?: string;
}

function OrderRow({ row, now, meta, agoPrefix }: OrderRowProps) {
  const { order, total } = row.entry;
  const reference = order.compraRef || shortOrderId(order.id);
  const ago = timeAgo(row.since, now);

  return (
    <li>
      <Link to={ORDERS_PATH} className="dash-order" title={`Abrir Encomendas (referência ${reference})`}>
        <span className="dash-order-ref">{reference}</span>
        <span className="dash-order-main">
          <span className="dash-order-name">{order.customer.fullName}</span>
          <span className="dash-order-meta">
            <span>{order.pickupPost || 'Loja não indicada'}</span>
            {meta}
          </span>
        </span>
        <span className="dash-order-side">
          <span className="dash-order-total">{formatPrice(total)}</span>
          {ago && <span className="dash-order-ago">{agoPrefix ? `${agoPrefix} ${ago}` : ago}</span>}
        </span>
      </Link>
    </li>
  );
}

interface OrderListProps {
  rows: OpsRow[];
  now: number;
  emptyText: string;
  meta?: (row: OpsRow) => ReactNode;
  agoPrefix?: string;
  limit?: number;
}

function OrderList({ rows, now, emptyText, meta, agoPrefix, limit = LIST_LIMIT }: OrderListProps) {
  if (rows.length === 0) {
    return (
      <p className="dash-ops-empty">
        <CircleCheck size={16} aria-hidden="true" />
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <ul className="dash-orders">
        {rows.slice(0, limit).map((row) => (
          <OrderRow key={row.entry.order.id} row={row} now={now} meta={meta?.(row)} agoPrefix={agoPrefix} />
        ))}
      </ul>
      {rows.length > limit && (
        <Link to={ORDERS_PATH} className="dash-ops-link dash-ops-more">
          e mais {formatCount(rows.length - limit)} em Encomendas
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </>
  );
}

/** Contagem decrescente dos pedidos Multicaixa Express (actualiza a cada segundo). */
function ExpressList({ rows }: { rows: OpsRow[] }) {
  const now = useNow(1000);
  return (
    <OrderList
      rows={rows}
      now={now}
      emptyText="Nenhum pagamento Express pendente."
      meta={(row) =>
        row.deadline == null ? null : row.deadline > now ? (
          <span className="dash-chip dash-chip--warning">
            <Timer size={13} aria-hidden="true" />
            expira em {timeLeft(row.deadline, now)}
          </span>
        ) : (
          <span className="dash-chip dash-chip--critical">
            <TimerOff size={13} aria-hidden="true" />
            prazo terminou {timeAgo(row.deadline, now)}
          </span>
        )
      }
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${orderStatusColors[status] ?? 'badge-gray'}`}>{status}</span>;
}

/** Estado da encomenda e do pagamento, para listas que misturam estados. */
function statusMeta(row: OpsRow): ReactNode {
  const payment = row.entry.order.payment;
  return (
    <>
      <StatusBadge status={row.entry.status} />
      {payment && <span>{PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</span>}
    </>
  );
}

function deliveryMeta(row: OpsRow): ReactNode {
  return <span>{row.entry.order.deliveryType === 'HOME_DELIVERY' ? 'Entrega ao domicílio' : 'Levantamento'}</span>;
}

const LOST_LABEL: Record<LostReason, { label: string; icon: LucideIcon }> = {
  cancelled: { label: 'Cancelada', icon: CircleX },
  expired: { label: 'Pagamento expirado', icon: TimerOff },
  failed: { label: 'Pagamento falhou', icon: TriangleAlert },
};

function lostMeta(row: OpsRow): ReactNode {
  const { label, icon: Icon } = LOST_LABEL[(row as LostRow).reason];
  return (
    <span className="dash-chip dash-chip--critical">
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

/* ---------- Cartões ---------- */

interface OpsCardProps {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  count: number | null;
  alert?: boolean;
  /** Rodapé do cartão; por omissão, a ligação para Encomendas. `null` não mostra rodapé. */
  footer?: ReactNode;
  children: ReactNode;
}

function OpsCard({ id, icon: Icon, title, subtitle, count, alert, footer, children }: OpsCardProps) {
  return (
    <section id={id} className={`dash-card dash-ops-card${alert ? ' dash-ops-card--alert' : ''}`} aria-labelledby={`${id}-title`}>
      <header className="dash-ops-head">
        <span className="dash-ops-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="dash-card-heading">
          <h2 className="dash-card-title" id={`${id}-title`}>
            {title}
          </h2>
          {subtitle && <p className="dash-card-subtitle">{subtitle}</p>}
        </div>
        {count !== null && <span className="dash-ops-count">{formatCount(count)}</span>}
      </header>
      {children}
      {footer !== null && (
        <footer className="dash-ops-footer">
          {footer ?? (
            <Link to={ORDERS_PATH} className="dash-ops-link">
              Ver em Encomendas
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </footer>
      )}
    </section>
  );
}

function SubGroup({ title, count, icon: Icon, children }: { title: string; count: number; icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="dash-subgroup">
      <h3 className="dash-subgroup-title">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {title}
        <span className="dash-subgroup-count">{formatCount(count)}</span>
      </h3>
      {children}
    </div>
  );
}

interface StockListProps {
  products: Product[];
  emptyText: string;
  canManageCatalog: boolean;
}

function StockList({ products, emptyText, canManageCatalog }: StockListProps) {
  if (products.length === 0) {
    return (
      <p className="dash-ops-empty">
        <CircleCheck size={16} aria-hidden="true" />
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <ul className="dash-orders">
        {products.slice(0, 8).map((product) => {
          const content = (
            <>
              <span className="dash-order-main">
                <span className="dash-order-name" title={product.name}>
                  {product.name}
                </span>
                <span className="dash-order-meta">{product.categoryName || 'Sem categoria'}</span>
              </span>
              <span className="dash-stock-qty">{(product.stock ?? 0) <= 0 ? 'Esgotado' : `${product.stock} em stock`}</span>
            </>
          );
          return (
            <li key={product.id}>
              {canManageCatalog ? (
                <Link to={`/backoffice/produtos/${product.id}`} className="dash-order dash-order--stock" title="Editar o produto">
                  {content}
                </Link>
              ) : (
                <div className="dash-order dash-order--stock">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {products.length > 8 && <p className="dash-ops-more dash-muted">e mais {formatCount(products.length - 8)}</p>}
    </>
  );
}

/* ---------- Vista ---------- */

interface OperationalViewProps {
  ops: OpsData;
  now: number;
  catalogProducts: Product[] | undefined;
  catalogLoading: boolean;
  catalogError: boolean;
  onRetryCatalog: () => void;
  canManageCatalog: boolean;
}

interface Tile {
  target: string;
  label: string;
  value: number | null;
  icon: LucideIcon;
  alert?: boolean;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function OperationalView({
  ops,
  now,
  catalogProducts,
  catalogLoading,
  catalogError,
  onRetryCatalog,
  canManageCatalog,
}: OperationalViewProps) {
  const stock = useMemo(() => (catalogProducts ? buildStock(catalogProducts) : null), [catalogProducts]);

  const awaitingPayment =
    ops.expressPending.length + ops.ibanWithoutProof.length + ops.ibanToVerify.length + ops.otherPending.length;

  const tiles: Tile[] = [
    { target: 'painel-comprovativos', label: 'Comprovativos IBAN por verificar', value: ops.ibanToVerify.length, icon: FileCheck, alert: ops.ibanToVerify.length > 0 },
    { target: 'painel-pagamentos', label: 'Aguardam pagamento', value: awaitingPayment, icon: Wallet },
    { target: 'painel-preparar', label: 'Pagas por preparar', value: ops.paidToPrepare.length, icon: PackageOpen },
    { target: 'painel-preparacao', label: 'Em preparação', value: ops.processing.length, icon: Boxes },
    { target: 'painel-prontas', label: 'Prontas a levantar ou entregar', value: ops.ready.length, icon: PackageCheck },
    { target: 'painel-levantamentos', label: 'Levantamentos hoje e amanhã', value: ops.pickupsToday.length + ops.pickupsTomorrow.length, icon: CalendarClock },
    { target: 'painel-entregas', label: 'Entregas ao domicílio por fazer', value: ops.deliveriesToDo.length, icon: Truck },
    { target: 'painel-stock', label: 'Esgotados ou com stock baixo', value: stock ? stock.soldOut.length + stock.low.length : null, icon: PackageX },
    { target: 'painel-perdidas', label: 'Canceladas ou expiradas (24 h)', value: ops.lostLast24h.length, icon: Ban },
  ];

  return (
    <div className="dash-view">
      <p className="dash-filter-note dash-ops-intro">
        Estado actual de todas as encomendas abertas e do stock, sem filtro de período. Clique numa linha para abrir
        Encomendas.
      </p>

      <div className="dash-tiles">
        {tiles.map(({ target, label, value, icon: Icon, alert }) => (
          <button
            key={target}
            type="button"
            className={`stat-card dash-tile${alert ? ' dash-tile--alert' : ''}${value === 0 ? ' dash-tile--quiet' : ''}`}
            onClick={() => scrollToSection(target)}
          >
            <Icon size={18} className="dash-tile-icon" aria-hidden="true" />
            <span className="stat-value">{value === null ? '—' : formatCount(value)}</span>
            <span className="stat-label">{label}</span>
          </button>
        ))}
      </div>

      <OpsCard
        id="painel-comprovativos"
        icon={FileCheck}
        title="IBAN com comprovativo por verificar"
        subtitle="O cliente já enviou o comprovativo da transferência. Confirme a entrada no banco e marque o pagamento em Encomendas. Os mais antigos primeiro."
        count={ops.ibanToVerify.length}
        alert={ops.ibanToVerify.length > 0}
      >
        <OrderList
          rows={ops.ibanToVerify}
          now={now}
          limit={10}
          emptyText="Nenhum comprovativo à espera de verificação."
          agoPrefix="comprovativo"
          meta={(row) =>
            row.entry.order.payment?.proofFileName ? (
              <span className="dash-proof-name" title={row.entry.order.payment.proofFileName}>
                {row.entry.order.payment.proofFileName}
              </span>
            ) : null
          }
        />
      </OpsCard>

      <div className="dash-ops-grid">
        <OpsCard
          id="painel-pagamentos"
          icon={Wallet}
          title="Aguardam pagamento"
          subtitle="Encomendas abertas com o pagamento por concluir."
          count={awaitingPayment}
        >
          <SubGroup title="Multicaixa Express pendentes" count={ops.expressPending.length} icon={Timer}>
            {ops.expressPending.length > 0 ? (
              <ExpressList rows={ops.expressPending} />
            ) : (
              <p className="dash-ops-empty">
                <CircleCheck size={16} aria-hidden="true" />
                Nenhum pagamento Express pendente.
              </p>
            )}
          </SubGroup>
          <SubGroup title="IBAN sem comprovativo" count={ops.ibanWithoutProof.length} icon={Landmark}>
            <OrderList rows={ops.ibanWithoutProof} now={now} emptyText="Nenhuma transferência à espera do comprovativo." />
          </SubGroup>
          <SubGroup title="IBAN com comprovativo por verificar" count={ops.ibanToVerify.length} icon={FileCheck}>
            <p className="dash-ops-hint">
              {ops.ibanToVerify.length > 0 ? (
                <button type="button" className="dash-link-button" onClick={() => scrollToSection('painel-comprovativos')}>
                  Ver a lista no topo
                </button>
              ) : (
                'Nenhum comprovativo por verificar.'
              )}
            </p>
          </SubGroup>
          {ops.otherPending.length > 0 && (
            <SubGroup title="Outros métodos (encomendas antigas)" count={ops.otherPending.length}>
              <OrderList
                rows={ops.otherPending}
                now={now}
                emptyText=""
                meta={(row) => {
                  const method = row.entry.order.payment?.method;
                  return method ? <span>{PAYMENT_METHOD_LABELS[method] ?? method}</span> : null;
                }}
              />
            </SubGroup>
          )}
        </OpsCard>

        <OpsCard
          id="painel-preparar"
          icon={PackageOpen}
          title="Pagas por preparar"
          subtitle="Pagamento confirmado e encomenda ainda pendente. As que esperam há mais tempo primeiro."
          count={ops.paidToPrepare.length}
        >
          <OrderList
            rows={ops.paidToPrepare}
            now={now}
            emptyText="Nenhuma encomenda paga à espera de preparação."
            agoPrefix="paga"
            meta={deliveryMeta}
          />
          {ops.pendingWithoutPayment > 0 && (
            <p className="dash-ops-hint">
              {countLabel(ops.pendingWithoutPayment, 'encomenda pendente não tem', 'encomendas pendentes não têm')} dados de
              pagamento (encomendas antigas) e não aparece nesta lista.
            </p>
          )}
        </OpsCard>

        <OpsCard
          id="painel-preparacao"
          icon={Boxes}
          title="Em preparação"
          subtitle="Encomendas em processamento na loja."
          count={ops.processing.length}
        >
          <OrderList rows={ops.processing} now={now} emptyText="Nenhuma encomenda em preparação." meta={deliveryMeta} />
        </OpsCard>

        <OpsCard
          id="painel-prontas"
          icon={PackageCheck}
          title="Prontas a levantar ou entregar"
          subtitle="Prontas para entrega, à espera do cliente ou do estafeta."
          count={ops.ready.length}
        >
          <OrderList rows={ops.ready} now={now} emptyText="Nenhuma encomenda pronta à espera." meta={deliveryMeta} />
        </OpsCard>

        <OpsCard
          id="painel-levantamentos"
          icon={CalendarClock}
          title="Levantamentos de hoje e amanhã"
          subtitle="Pela data de levantamento escolhida no checkout; só encomendas abertas."
          count={ops.pickupsToday.length + ops.pickupsTomorrow.length}
        >
          <SubGroup title="Hoje" count={ops.pickupsToday.length}>
            <OrderList rows={ops.pickupsToday} now={now} emptyText="Nenhum levantamento marcado para hoje." meta={statusMeta} />
          </SubGroup>
          <SubGroup title="Amanhã" count={ops.pickupsTomorrow.length}>
            <OrderList rows={ops.pickupsTomorrow} now={now} emptyText="Nenhum levantamento marcado para amanhã." meta={statusMeta} />
          </SubGroup>
        </OpsCard>

        <OpsCard
          id="painel-entregas"
          icon={Truck}
          title="Entregas ao domicílio por fazer"
          subtitle="Encomendas abertas com entrega ao domicílio, pela data prevista."
          count={ops.deliveriesToDo.length}
        >
          <OrderList
            rows={ops.deliveriesToDo}
            now={now}
            emptyText="Nenhuma entrega ao domicílio por fazer."
            meta={(row) => {
              const { pickupDate, deliveryAddress } = row.entry.order;
              return (
                <>
                  {statusMeta(row)}
                  {pickupDate && <span>para {dayMonth(pickupDate.slice(0, 10))}</span>}
                  {deliveryAddress?.district && <span>{deliveryAddress.district}</span>}
                </>
              );
            }}
          />
        </OpsCard>

        <OpsCard
          id="painel-stock"
          icon={PackageX}
          title="Stock"
          subtitle={`Produtos à venda esgotados ou com ${LOW_STOCK_LIMIT} unidades ou menos (sem os livros).`}
          count={stock ? stock.soldOut.length + stock.low.length : null}
          footer={
            canManageCatalog ? (
              <Link to="/backoffice/produtos" className="dash-ops-link">
                Ver em Produtos
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : null
          }
        >
          {catalogLoading ? (
            <p className="dash-ops-empty">A carregar os produtos…</p>
          ) : catalogError || !stock ? (
            <div className="dash-ops-empty dash-ops-empty--error">
              <span>Não foi possível carregar os produtos.</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={onRetryCatalog}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <SubGroup title="Esgotados" count={stock.soldOut.length} icon={CircleX}>
                <StockList products={stock.soldOut} emptyText="Nenhum produto esgotado." canManageCatalog={canManageCatalog} />
              </SubGroup>
              <SubGroup title={`Stock baixo (≤ ${LOW_STOCK_LIMIT})`} count={stock.low.length} icon={TriangleAlert}>
                <StockList products={stock.low} emptyText="Nenhum produto com stock baixo." canManageCatalog={canManageCatalog} />
              </SubGroup>
            </>
          )}
        </OpsCard>

        <OpsCard
          id="painel-perdidas"
          icon={Ban}
          title="Canceladas ou expiradas nas últimas 24 h"
          subtitle="Inclui os pagamentos expirados ou falhados, que cancelam a encomenda. Pela data da encomenda (ou do fim do prazo do Express)."
          count={ops.lostLast24h.length}
        >
          <OrderList
            rows={ops.lostLast24h}
            now={now}
            emptyText="Nenhuma encomenda perdida nas últimas 24 horas."
            meta={lostMeta}
          />
        </OpsCard>
      </div>
    </div>
  );
}
