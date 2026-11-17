import { CreditCard, Gift, MapPin, Truck, User } from 'lucide-react';
import { getOrderUnits, shortOrderId } from '../../api/orders';
import { toOrderView } from '../../catalog/orderView';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../config/store';
import { orderStatusColors } from '../../constants/orderStatus';
import type { ApiOrder } from '../../types/api';
import { formatDate as formatDay } from '../../utils/format';
import { formatDate, formatPrice } from '../../utils/helpers';
import { Modal } from '../ui/Modal';
import { OrderPaymentProof } from './OrderPaymentProof';
import { Thumbnail } from './Thumbnail';
import './OrderItemsModal.css';

interface OrderItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ApiOrder | null;
  /** A encomenda mudou aqui dentro (pagamento confirmado ou recusado). */
  onOrderUpdated?: (order: ApiOrder) => void;
}

export function OrderItemsModal({ isOpen, onClose, order, onOrderUpdated }: OrderItemsModalProps) {
  if (!order) return null;

  // Entrega, pagamento e oferta só vêm da API depois de o backend os implementar; até lá estão nas observações.
  const view = toOrderView(order, null);
  const home = view.deliveryType === 'HOME_DELIVERY';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Encomenda ${shortOrderId(order.id)}`} maxWidth="680px">
      <div className="order-items-modal">
        <div className="order-items-modal-meta">
          <div className="order-items-modal-meta-item">
            <User size={16} />
            <div>
              <span className="order-items-modal-label">Cliente</span>
              <span className="order-items-modal-value">{order.customer.fullName}</span>
              <span className="order-items-modal-subvalue">
                {order.customer.phone} · {order.customer.email}
              </span>
              <span className="order-items-modal-subvalue">
                {order.customer.location}
                {view.customer.nif ? ` · NIF ${view.customer.nif}` : ''}
              </span>
            </div>
          </div>
          <div className="order-items-modal-meta-item">
            {home ? <Truck size={16} /> : <MapPin size={16} />}
            <div>
              <span className="order-items-modal-label">{home ? 'Entrega ao domicílio' : 'Levantamento'}</span>
              {home && view.deliveryAddress ? (
                <>
                  <span className="order-items-modal-value">{view.deliveryAddress.address}</span>
                  <span className="order-items-modal-subvalue">
                    {[view.deliveryAddress.district, view.deliveryAddress.reference].filter(Boolean).join(' · ')}
                  </span>
                  <span className="order-items-modal-subvalue">Preparada em {order.pickupPost}</span>
                </>
              ) : (
                <>
                  <span className="order-items-modal-value">{order.pickupPost}</span>
                  {view.pickupDate && (
                    <span className="order-items-modal-subvalue">
                      A partir de {formatDay(view.pickupDate, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          {view.payment.fromApi && (
            <div className="order-items-modal-meta-item">
              <CreditCard size={16} />
              <div>
                <span className="order-items-modal-label">Pagamento</span>
                <span className="order-items-modal-value">
                  {PAYMENT_METHOD_LABELS[view.payment.method]} · {PAYMENT_STATUS_LABELS[view.payment.status]}
                </span>
                {view.payment.reference && (
                  <span className="order-items-modal-subvalue">
                    Entidade {view.payment.entity} · Ref. {view.payment.reference}
                  </span>
                )}
                {view.payment.phone && <span className="order-items-modal-subvalue">Multicaixa Express {view.payment.phone}</span>}
                {view.payment.status === 'PAID' && order.payment?.paidAt && (
                  <span className="order-items-modal-subvalue">Confirmado {formatDate(order.payment.paidAt)}</span>
                )}
                {(view.payment.status === 'FAILED' || view.payment.status === 'EXPIRED') &&
                  (view.payment.failureMessage || view.payment.failureCode) && (
                    <span className="order-items-modal-subvalue order-items-modal-subvalue--erro">
                      {view.payment.failureMessage ?? 'Sem descrição'}
                      {view.payment.failureCode && ` · ${view.payment.failureCode}`}
                      {view.payment.failureType && ` (${view.payment.failureType})`}
                    </span>
                  )}
              </div>
            </div>
          )}
          {order.gift && (
            <div className="order-items-modal-meta-item">
              <Gift size={16} />
              <div>
                <span className="order-items-modal-label">Oferta</span>
                <span className="order-items-modal-value">Para {order.gift.recipient}</span>
                {order.gift.message && <span className="order-items-modal-subvalue">“{order.gift.message}”</span>}
              </div>
            </div>
          )}
        </div>

        <OrderPaymentProof
          key={`${order.id}-${order.payment?.proofUploadedAt ?? ''}`}
          order={order}
          onUpdated={(updated) => onOrderUpdated?.(updated)}
        />

        <div className="order-items-modal-status-row">
          <span className={`badge ${orderStatusColors[order.status] ?? 'badge-gray'}`}>{order.status}</span>
          <span className="order-items-modal-date">{formatDate(order.createAt)}</span>
        </div>
        <p className="order-items-modal-id mono">
          N.º {order.id}
          {order.compraRef && ` · Referência da compra ${order.compraRef}`}
        </p>

        {order.notes?.trim() && (
          <div className="order-items-modal-notes">
            <span className="order-items-modal-label">Observações</span>
            <p style={{ whiteSpace: 'pre-line' }}>{order.notes}</p>
          </div>
        )}

        <div className="order-items-modal-section">
          <h3>Artigos ({getOrderUnits(order)})</h3>
          <ul className="order-items-modal-list">
            {order.items.map((item) => (
              <li key={item.id} className="order-items-modal-item">
                <Thumbnail title={item.book} src={item.coverImage} className="order-items-modal-thumb" />
                <div className="order-items-modal-info">
                  <h4>{item.book}</h4>
                  <span className="order-items-modal-unit-price">{formatPrice(item.price)} / un.</span>
                </div>
                <div className="order-items-modal-qty">×{Number(item.quantity)}</div>
                <div className="order-items-modal-subtotal">{formatPrice(item.subTotal ?? item.price * item.quantity)}</div>
              </li>
            ))}
          </ul>
        </div>

        {view.deliveryFee > 0 && (
          <div className="order-items-modal-total order-items-modal-total--secundario">
            <span>Taxa de entrega</span>
            <span>{formatPrice(view.deliveryFee)}</span>
          </div>
        )}
        <div className="order-items-modal-total">
          <span>Total</span>
          <span>{formatPrice(view.total)}</span>
        </div>
      </div>
    </Modal>
  );
}
