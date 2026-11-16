import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchOrder, fetchOrderTracking, getOrderTotal, shortOrderId } from '../../api/orders';
import { pickupPostDetails } from '../../api/pickupPosts';
import { getLocalOrder, listLocalOrders, normaliseOrderId } from '../../catalog/localOrders';
import { toOrderView, type OrderView } from '../../catalog/orderView';
import { CheckoutSteps } from '../../components/store/CheckoutSteps';
import { Breadcrumbs } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { ProductImage } from '../../components/store/ProductBits';
import { hasApiFeature, PAYMENT_METHOD_LABELS } from '../../config/store';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { useAuth } from '../../context/auth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { usePickupPosts } from '../../hooks/usePickupPosts';
import type { OrderCustomer } from '../../types/api';
import { formatDate, formatKz, formatPhone } from '../../utils/format';

type StepKey = 'received' | 'paid' | 'preparing' | 'ready';

function isOnline(view: OrderView): boolean {
  return view.payment.method !== 'IN_STORE';
}

function normalisedStatus(view: OrderView): string {
  return view.status === ORDER_STATUS.ACTIVE ? ORDER_STATUS.PENDING : view.status;
}

/** Passo atingido (como no layout: o passo actual é o último estado alcançado). */
function currentStep(view: OrderView): StepKey | 'done' {
  switch (normalisedStatus(view)) {
    case ORDER_STATUS.DELIVERED:
      return 'done';
    case ORDER_STATUS.READY:
      return 'ready';
    case ORDER_STATUS.PROCESSING:
      return 'preparing';
    default:
      return isOnline(view) && view.payment.status === 'PAID' ? 'paid' : 'received';
  }
}

function orderTitle(view: OrderView): string {
  const home = view.deliveryType === 'HOME_DELIVERY';
  switch (normalisedStatus(view)) {
    case ORDER_STATUS.CANCELLED:
      return 'Encomenda cancelada';
    case ORDER_STATUS.DELIVERED:
      return home ? 'Encomenda entregue' : 'Encomenda levantada';
    case ORDER_STATUS.READY:
      return home ? 'Encomenda a caminho' : 'Encomenda pronta a levantar';
    case ORDER_STATUS.PROCESSING:
      return 'Encomenda em preparação';
    default:
      return currentStep(view) === 'paid' ? 'Pagamento confirmado' : 'Encomenda recebida';
  }
}

function StatusSteps({ view }: { view: OrderView }) {
  const home = view.deliveryType === 'HOME_DELIVERY';
  const paid = view.payment.status === 'PAID';
  const steps: { key: StepKey; title: string; note: string }[] = [
    { key: 'received', title: 'Recebida', note: 'Encomenda registada' },
    ...(isOnline(view)
      ? [{ key: 'paid' as const, title: paid ? 'Pagamento confirmado' : 'Pagamento', note: PAYMENT_METHOD_LABELS[view.payment.method] }]
      : []),
    { key: 'preparing', title: 'Em preparação', note: 'Na loja Super7' },
    home
      ? { key: 'ready', title: 'A caminho', note: 'Entrega na morada indicada' }
      : { key: 'ready', title: 'Pronta a levantar', note: isOnline(view) ? view.pickupPost || 'Na loja que escolheu' : 'Pagamento no levantamento' },
  ];
  const current = currentStep(view);
  const currentIndex = current === 'done' ? steps.length : steps.findIndex((step) => step.key === current);

  return (
    <ol className="s7-estado">
      {steps.map((step, index) => {
        const classes = [index < currentIndex ? 's7-estado--feito' : '', index === currentIndex ? 's7-estado--actual' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <li key={step.key} className={classes || undefined} aria-current={index === currentIndex ? 'step' : undefined}>
            <strong>{step.title}</strong>
            <span>{step.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PaymentCard({ view }: { view: OrderView }) {
  const { payment, total } = view;
  const amount = payment.amount ?? total;
  let detail: string;

  if (payment.status === 'PAID') {
    detail = 'Pagamento confirmado.';
  } else if (payment.status === 'FAILED' || payment.status === 'EXPIRED') {
    detail =
      payment.status === 'EXPIRED'
        ? 'O prazo de pagamento terminou. Contacte a loja ou faça uma nova encomenda.'
        : 'O pagamento não foi concluído. Contacte a loja ou faça uma nova encomenda.';
  } else if (payment.method === 'IN_STORE') {
    detail = `Paga ${formatKz(total)} na loja, no acto do levantamento, com Multicaixa ou em numerário.`;
  } else if (payment.method === 'MULTICAIXA_EXPRESS') {
    detail = payment.phone
      ? `Confirme o pagamento de ${formatKz(amount)} na aplicação Multicaixa Express do número ${formatPhone(payment.phone)}.`
      : `Confirme o pagamento de ${formatKz(amount)} na aplicação Multicaixa Express.`;
  } else {
    detail = payment.reference
      ? 'Pague num Multicaixa ou no homebanking com os dados abaixo.'
      : 'A referência de pagamento está a ser gerada. Aparece aqui e no seu e-mail assim que estiver pronta.';
  }

  return (
    <section className="s7-ficha__item">
      <h3>
        <Icon name="cartao" /> Pagamento
      </h3>
      <p>
        <strong>{PAYMENT_METHOD_LABELS[payment.method]}</strong>
      </p>
      <p>{detail}</p>
      {payment.method === 'REFERENCE' && payment.reference && payment.status === 'PENDING' && (
        <dl className="s7-referencia">
          <dt>Entidade</dt>
          <dd>{payment.entity}</dd>
          <dt>Referência</dt>
          <dd>{payment.reference}</dd>
          <dt>Montante</dt>
          <dd>{formatKz(amount)}</dd>
          {payment.expiresAt && (
            <>
              <dt>Válida até</dt>
              <dd>{formatDate(payment.expiresAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

function DeliveryCard({ view }: { view: OrderView }) {
  const { data: posts } = usePickupPosts();
  const post = posts?.find((item) => item.id === view.pickupPostId);

  if (view.deliveryType === 'HOME_DELIVERY' && view.deliveryAddress) {
    return (
      <section className="s7-ficha__item">
        <h3>
          <Icon name="camiao" /> Entrega ao domicílio
        </h3>
        <p>
          <strong>{view.deliveryAddress.address}</strong>
        </p>
        <p>{[view.deliveryAddress.district, view.deliveryAddress.reference].filter(Boolean).join(' · ')}</p>
        {view.pickupPost && <p>Preparada na loja {view.pickupPost}.</p>}
      </section>
    );
  }

  const details = pickupPostDetails(post);
  return (
    <section className="s7-ficha__item">
      <h3>
        <Icon name="pin" /> Levantamento
      </h3>
      <p>
        <strong>{view.pickupPost || 'Loja Super7'}</strong>
      </p>
      {details && <p>{details}</p>}
      {view.pickupDate && (
        <p>A partir de {formatDate(view.pickupDate, { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
      )}
    </section>
  );
}

function OrderDetails({ view, fromDevice }: { view: OrderView; fromDevice: boolean }) {
  const { state } = useLocation();
  const justPlaced = Boolean((state as { placed?: boolean } | null)?.placed);
  const cancelled = view.status === ORDER_STATUS.CANCELLED;
  const firstName = view.customer.fullName.split(' ')[0];
  useDocumentTitle(`Encomenda ${shortOrderId(view.id)}`);

  return (
    <>
      {justPlaced && (
        <div className="s7-pagina-titulo s7-pagina-titulo--etapas">
          <CheckoutSteps current={3} />
        </div>
      )}

      <header className={cancelled ? 's7-confirmacao s7-confirmacao--cancelada' : 's7-confirmacao'}>
        <span className="s7-confirmacao__ico">
          <Icon name={cancelled ? 'alerta' : 'check'} />
        </span>
        <div>
          <h1>{orderTitle(view)}</h1>
          <p>
            {justPlaced
              ? `Obrigado${firstName ? `, ${firstName}` : ''}! Enviámos a confirmação para ${view.customer.email}.`
              : `Registada a ${formatDate(view.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}${view.customer.fullName ? ` em nome de ${view.customer.fullName}` : ''}.`}
          </p>
        </div>
        <p className="s7-confirmacao__ref">
          <span>N.º da encomenda</span>
          <b>{view.id}</b>
        </p>
      </header>

      <div className="s7-encomenda">
        <div className="s7-encomenda__col">
          <section className="s7-bloco" aria-labelledby="s7-estado-titulo">
            <h2 id="s7-estado-titulo">Estado da encomenda</h2>
            {cancelled ? (
              <p>
                Esta encomenda foi cancelada. Se tiver dúvidas, fale com a loja {view.pickupPost} ou responda ao e-mail que
                recebeu.
              </p>
            ) : (
              <StatusSteps view={view} />
            )}
            {fromDevice && view.customer.email && (
              <p className="s7-bloco__nota">
                <Icon name="relogio" />
                <span>
                  Este é o estado no momento em que fez a encomenda. As actualizações chegam por e-mail para{' '}
                  <strong>{view.customer.email}</strong>.
                </span>
              </p>
            )}
          </section>

          <div className="s7-ficha">
            <DeliveryCard view={view} />
            <PaymentCard view={view} />

            {view.gift && (
              <section className="s7-ficha__item">
                <h3>
                  <Icon name="gift" /> Oferta
                </h3>
                <p>
                  <strong>Para {view.gift.recipient}</strong>
                </p>
                <p>{view.gift.message ? `“${view.gift.message}”` : 'Cartão Boas Festas sem mensagem.'}</p>
              </section>
            )}

            {(view.customer.phone || view.customer.email) && (
              <section className="s7-ficha__item">
                <h3>
                  <Icon name="recibo" /> Contacto
                </h3>
                <p>
                  <strong>{view.customer.fullName}</strong>
                </p>
                <p>{[view.customer.phone && formatPhone(view.customer.phone), view.customer.email].filter(Boolean).join(' · ')}</p>
                {view.customer.nif && <p>NIF {view.customer.nif}</p>}
              </section>
            )}
          </div>
        </div>

        <aside className="s7-resumo" aria-labelledby="s7-resumo-titulo">
          <h2 id="s7-resumo-titulo">Artigos</h2>
          <ul className="s7-resumo__itens">
            {view.items.map((item) => (
              <li key={item.id}>
                <div className="s7-linha__media">
                  <ProductImage
                    product={{ name: item.book, image: item.coverImage ?? null, categoryIcon: 'box' }}
                    size={104}
                    width={52}
                    height={52}
                    alt=""
                  />
                </div>
                <p>
                  <strong>{item.book}</strong>
                  <span>
                    {Number(item.quantity)} × {formatKz(item.price)}
                  </span>
                </p>
                <b>{formatKz(item.subTotal ?? item.price * item.quantity)}</b>
              </li>
            ))}
          </ul>
          <dl className="s7-resumo__linhas">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatKz(view.subtotal)}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{view.deliveryFee > 0 ? formatKz(view.deliveryFee) : 'Sem custo'}</dd>
            </div>
          </dl>
          <p className="s7-resumo__total">
            <span>Total</span>
            <strong>{formatKz(view.total)}</strong>
          </p>
          <Link className="s7-btn s7-btn--contorno s7-btn--bloco" to="/catalogo">
            Continuar a comprar
          </Link>
        </aside>
      </div>
    </>
  );
}

function OrderUnavailable({ id, failed }: { id: string; failed: boolean }) {
  useDocumentTitle('Encomenda');

  return (
    <div className="s7-consulta">
      <p className="s7-sobretitulo">
        <Icon name="recibo" /> Encomenda
      </p>
      <h1>Encomenda n.º {shortOrderId(id)}</h1>
      <p>
        {failed
          ? 'Não conseguimos obter esta encomenda. Confirme o número ou tente novamente dentro de alguns minutos.'
          : 'Os detalhes desta encomenda não estão guardados neste dispositivo. A confirmação e cada mudança de estado foram enviadas para o e-mail indicado na encomenda.'}
      </p>
      <p>Se precisar de ajuda, dirija-se à loja Super7 da sua encomenda.</p>
      <div className="s7-consulta__accoes">
        <Link className="s7-btn s7-btn--primario" to="/catalogo">
          Continuar a comprar
        </Link>
        <Link className="s7-btn s7-btn--contorno" to="/encomenda">
          Consultar outra encomenda
        </Link>
      </div>
    </div>
  );
}

function mergeFilled(saved: OrderCustomer, fresh: Partial<OrderCustomer> | null | undefined): OrderCustomer {
  const result = { ...saved };
  (Object.keys(fresh ?? {}) as (keyof OrderCustomer)[]).forEach((key) => {
    const value = fresh?.[key];
    if (value) result[key] = value;
  });
  return result;
}

function OrderLoader({ id }: { id: string }) {
  const { can } = useAuth();
  const staff = can('viewOrders');
  const tracking = hasApiFeature('order-tracking');
  const [local] = useState(() => getLocalOrder(id));

  // A equipa vê a encomenda completa; o cliente usa o seguimento público quando existir
  // (`api_features=order-tracking`) e, até lá, a cópia guardada no checkout.
  const remote = useQuery({
    queryKey: ['order', id, staff ? 'equipa' : 'seguimento'],
    queryFn: () => (staff ? fetchOrder(id) : fetchOrderTracking(id)),
    enabled: staff || tracking,
    retry: false,
  });

  const order = remote.data ?? local?.order ?? null;
  const loading = (staff || tracking) && remote.isLoading;

  if (!order && loading) {
    return (
      <p className="s7-carregar" role="status">
        A carregar a encomenda…
      </p>
    );
  }

  if (!order) return <OrderUnavailable id={id} failed={(staff || tracking) && remote.isError} />;

  // O seguimento público não traz e-mail nem telefone: completa-se com a cópia local, se existir
  // (só os valores preenchidos da API substituem os guardados).
  const merged =
    remote.data && local
      ? { ...remote.data, customer: mergeFilled(local.order.customer, remote.data.customer) }
      : order;
  return <OrderDetails view={toOrderView(merged, local?.extras ?? null)} fromDevice={!remote.data} />;
}

function OrderLookup({ initial = '', invalid = false }: { initial?: string; invalid?: boolean }) {
  useDocumentTitle('Consultar encomenda');
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(invalid);
  const [recent] = useState(() => listLocalOrders().slice(0, 5));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = normaliseOrderId(value);
    if (!id) {
      setError(true);
      document.getElementById('s7-ref')?.focus();
      return;
    }
    navigate(`/encomenda/${id}`);
  };

  return (
    <div className="s7-consulta">
      <p className="s7-sobretitulo">
        <Icon name="recibo" /> Encomendas
      </p>
      <h1>Consultar encomenda</h1>
      <p>Indique o número da encomenda que recebeu no e-mail de confirmação.</p>
      <form className="s7-consulta__form" noValidate onSubmit={submit}>
        <div className={error ? 's7-campo s7-campo--erro' : 's7-campo'}>
          <label htmlFor="s7-ref">N.º da encomenda</label>
          <input
            id="s7-ref"
            name="ref"
            type="text"
            placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={error || undefined}
            aria-describedby={error ? 's7-ref-erro' : undefined}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(false);
            }}
          />
          <p className="s7-campo__erro" id="s7-ref-erro" role="alert">
            Confirme o número: tem 36 caracteres, com letras, números e hífenes.
          </p>
        </div>
        <button className="s7-btn s7-btn--primario" type="submit">
          Consultar
        </button>
      </form>

      {recent.length > 0 && (
        <div className="s7-consulta__recentes">
          <h2>Feitas neste dispositivo</h2>
          <ul>
            {recent.map(({ order, extras }) => (
              <li key={order.id}>
                <Link to={`/encomenda/${order.id}`}>
                  <strong>N.º {shortOrderId(order.id)}</strong>
                  <span>
                    {formatDate(order.createAt)} · {formatKz(toOrderView(order, extras).total || getOrderTotal(order))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** `/encomenda/:id` (link dos e-mails da API) e `/encomenda` (consulta). */
export function OrderPage() {
  const { id } = useParams();
  const normalised = id ? normaliseOrderId(id) : null;

  return (
    <main id="conteudo" className="s7-contentor">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Encomenda' }]} />
      {normalised ? (
        <OrderLoader key={normalised} id={normalised} />
      ) : (
        <OrderLookup key={id ?? ''} initial={id ?? ''} invalid={Boolean(id)} />
      )}
    </main>
  );
}
