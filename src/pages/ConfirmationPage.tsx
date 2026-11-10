import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle, Mail, MessageCircle, MapPin, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrder } from '../hooks/useOrder';
import { getOrderTotal } from '../api/orders';
import { formatPrice, formatDate } from '../utils/helpers';
import { trackMetaPurchase } from '../utils/metaPixel';
import type { Order } from '../types';
import type { ApiOrderDetail } from '../types/api';
import './ConfirmationPage.css';

interface ConfirmationView {
  id: string;
  email: string;
  phone: string;
  pickupPost: string;
  createdAt: string;
  total: number;
  items: Array<{ id: string; title: string; quantity: number; lineTotal: number }>;
}

function fromLocalOrder(order: Order): ConfirmationView {
  return {
    id: order.id,
    email: order.customer.email,
    phone: order.customer.phone,
    pickupPost: order.customer.pickupPostName ?? order.customer.pickupPostId,
    createdAt: order.createdAt,
    total: order.total,
    items: order.items.map(({ book, quantity }) => ({
      id: book.id,
      title: book.title,
      quantity,
      lineTotal: book.price * quantity,
    })),
  };
}

function fromApiOrder(order: ApiOrderDetail): ConfirmationView {
  return {
    id: String(order.id),
    email: order.customer.email,
    phone: order.customer.phone,
    pickupPost: order.pickupPost,
    createdAt: order.createAt,
    total: getOrderTotal(order),
    items: order.items.map((item) => ({
      id: String(item.id),
      title: item.book,
      quantity: item.quantity,
      lineTotal: item.subTotal ?? item.price * item.quantity,
    })),
  };
}

export function ConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const { orders } = useCart();
  const purchaseTracked = useRef(false);

  const stateOrder = (location.state as { order?: Order } | null)?.order;
  const cartOrder = orders.find((o) => o.id === orderId);
  const localOrder = stateOrder ?? cartOrder;

  const {
    data: apiOrder,
    isLoading,
    isError,
  } = useOrder(localOrder ? undefined : orderId);

  const view = localOrder
    ? fromLocalOrder(localOrder)
    : apiOrder
      ? fromApiOrder(apiOrder)
      : undefined;

  useEffect(() => {
    // Only count conversion on the real checkout redirect, not on later URL visits.
    if (!stateOrder || purchaseTracked.current) return;
    purchaseTracked.current = true;
    trackMetaPurchase({
      value: stateOrder.total,
      currency: 'AOA',
      contentIds: stateOrder.items.map(({ book }) => book.id),
      numItems: stateOrder.items.reduce((sum, { quantity }) => sum + quantity, 0),
      orderId: stateOrder.id,
    });
  }, [stateOrder]);

  if (!localOrder && isLoading) {
    return (
      <div className="confirmation-page">
        <div className="container confirmation-empty">
          <p>A carregar encomenda...</p>
        </div>
      </div>
    );
  }

  if (!view || (!localOrder && isError)) {
    return (
      <div className="confirmation-page">
        <div className="container confirmation-empty">
          <h2>Encomenda não encontrada</h2>
          <p>Não foi possível encontrar a encomenda <strong>#{orderId}</strong>.</p>
          <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation-page">
      <div className="container">
        <div className="confirmation-card animate-fade-in-up">
          <div className="confirmation-icon">
            <CheckCircle size={64} />
          </div>

          <h1>Encomenda Confirmada!</h1>
          <p className="confirmation-subtitle">
            O seu pedido foi recebido com sucesso. Referência: <strong>{view.id}</strong>
          </p>

          <div className="confirmation-notifications">
            <div className="notification-badge">
              <Mail size={20} />
              <div>
                <strong>Email enviado</strong>
                <span>Resumo enviado para {view.email}</span>
              </div>
            </div>
            <div className="notification-badge">
              <MessageCircle size={20} />
              <div>
                <strong>WhatsApp enviado</strong>
                <span>Confirmação enviada para {view.phone}</span>
              </div>
            </div>
          </div>

          <div className="confirmation-details">
            <div className="confirmation-detail">
              <MapPin size={18} />
              <div>
                <span className="detail-label">Posto de levantamento</span>
                <span className="detail-value">{view.pickupPost}</span>
              </div>
            </div>
            <div className="confirmation-detail">
              <span className="detail-label">Data do pedido</span>
              <span className="detail-value">{formatDate(view.createdAt)}</span>
            </div>
          </div>

          <div className="confirmation-items">
            <h3>Livros encomendados</h3>
            <ul>
              {view.items.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <span>x{item.quantity}</span>
                  <span>{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="confirmation-total">
              <span>Total</span>
              <span>{formatPrice(view.total)}</span>
            </div>
          </div>

          <div className="confirmation-actions">
            <Link to="/catalogo" className="btn btn-secondary">
              Continuar a Comprar
            </Link>
            <Link to="/" className="btn btn-primary">
              Voltar ao Início
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
