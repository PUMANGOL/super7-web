import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/client';
import {
  confirmOrderReceived,
  fetchOrder,
  fetchOrderTracking,
  getOrderTotal,
  shortOrderId,
  uploadPaymentProof,
} from '../../api/orders';
import { pickupPostDetails } from '../../api/pickupPosts';
import { getLocalOrder, listLocalOrders, normaliseOrderId, updateLocalOrderPayment } from '../../catalog/localOrders';
import { toOrderView, type OrderPaymentView, type OrderView } from '../../catalog/orderView';
import { atPickupPost } from '../../catalog/storeCopy';
import { useCheckoutOptions, useExpressWindow } from '../../catalog/useStoreSettings';
import { checkProofFile, PROOF_HELP } from '../../catalog/paymentProof';
import { BankTransferList, ProofFileInput } from '../../components/store/BankTransfer';
import { CheckoutSteps, type CheckoutStep } from '../../components/store/CheckoutSteps';
import { Breadcrumbs } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { MapLink } from '../../components/store/MapLink';
import { PaidDialog } from '../../components/store/PaidDialog';
import {
  ExpressCountdown,
  ExpressRetryForm,
  ExpressTimeLeft,
  IbanSwitchButton,
} from '../../components/store/PaymentAttempt';
import { ProductImage } from '../../components/store/ProductBits';
import { hasApiFeature, PAYMENT_METHOD_LABELS } from '../../config/store';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { useAuth } from '../../context/auth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { usePickupPosts } from '../../hooks/usePickupPosts';
import type { ApiOrder, OrderCustomer, OrderPayment } from '../../types/api';
import { formatCountdown, formatDate, formatKz, formatPhone } from '../../utils/format';
import { serverNow, useServerNow } from '../../utils/serverClock';

type StepKey = 'received' | 'awaiting' | 'paid' | 'preparing' | 'ready' | 'delivered';

/** Pago antes do levantamento ou da entrega (Multicaixa Express, IBAN; encomendas antigas por referência). */
function isOnline(view: OrderView): boolean {
  return view.payment.method !== 'IN_STORE';
}

function normalisedStatus(view: OrderView): string {
  return view.status === ORDER_STATUS.ACTIVE ? ORDER_STATUS.PENDING : view.status;
}

/** Passo atingido (como no layout: o passo actual é o último estado alcançado). */
function currentStep(view: OrderView): StepKey {
  switch (normalisedStatus(view)) {
    case ORDER_STATUS.DELIVERED:
      return 'delivered';
    case ORDER_STATUS.READY:
      return 'ready';
    case ORDER_STATUS.PROCESSING:
      return 'preparing';
    default:
      if (!isOnline(view)) return 'received';
      return view.payment.status === 'PAID' ? 'paid' : 'awaiting';
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
    default: {
      const step = currentStep(view);
      if (step === 'paid') return 'Pagamento confirmado';
      return step === 'awaiting' ? 'A aguardar o pagamento' : 'Encomenda recebida';
    }
  }
}

/** Passo da barra "Passos da encomenda" (Carrinho … Levantei!); null numa encomenda cancelada. */
function orderStep(view: OrderView): CheckoutStep | null {
  switch (normalisedStatus(view)) {
    case ORDER_STATUS.CANCELLED:
      return null;
    case ORDER_STATUS.DELIVERED:
      return 'levantada';
    case ORDER_STATUS.READY:
      return 'pronto';
    case ORDER_STATUS.PROCESSING:
      return 'preparacao';
    default:
      if (!isOnline(view)) return 'dados';
      return view.payment.status === 'PAID' ? 'pago' : 'pagamento';
  }
}

/** Barra com os passos da encomenda no topo da página; `current` fixa o passo (por exemplo, à espera do pagamento). */
function OrderStepsBar({ view, current }: { view: OrderView; current?: CheckoutStep }) {
  const step = current ?? orderStep(view);
  if (!step) return null;
  return (
    <div className="s7-pagina-titulo s7-pagina-titulo--etapas">
      <CheckoutSteps current={step} homeDelivery={view.deliveryType === 'HOME_DELIVERY'} payOnPickup={!isOnline(view)} />
    </div>
  );
}

/** "sábado, 18 de novembro, às 19:30" (data e hora curtas para a confirmação do levantamento). */
function formatMoment(iso: string): string {
  return formatDate(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function StatusSteps({ view }: { view: OrderView }) {
  const home = view.deliveryType === 'HOME_DELIVERY';
  const steps: { key: StepKey; title: string; note: string }[] = [
    { key: 'received', title: 'Recebida', note: 'Encomenda registada' },
    ...(isOnline(view)
      ? [
          { key: 'awaiting' as const, title: 'Aguarda pagamento', note: PAYMENT_METHOD_LABELS[view.payment.method] },
          {
            key: 'paid' as const,
            title: 'Pagamento confirmado',
            note: view.payment.method === 'IBAN' ? 'Verificado pela loja' : 'Confirmado pelo Multicaixa Express',
          },
        ]
      : []),
    { key: 'preparing', title: 'Em preparação', note: 'Na loja Super7' },
    home
      ? { key: 'ready', title: 'A caminho', note: 'Entrega na morada indicada' }
      : { key: 'ready', title: 'Pronta a levantar', note: isOnline(view) ? view.pickupPost || 'Na loja que escolheu' : 'Pagamento no levantamento' },
    {
      key: 'delivered',
      title: home ? 'Recebida' : 'Levantada',
      note: view.customerConfirmedAt
        ? `Confirmado por si a ${formatMoment(view.customerConfirmedAt)}`
        : home
          ? 'Confirme quando a receber'
          : 'Confirme quando a levantar',
    },
  ];
  const current = currentStep(view);
  const currentIndex = steps.findIndex((step) => step.key === current);
  // Levantada (ou recebida) é o fim: todos os passos ficam feitos, o último também.
  const finished = current === 'delivered';

  return (
    <ol className="s7-estado">
      {steps.map((step, index) => {
        const done = index < currentIndex || finished;
        const classes = [done ? 's7-estado--feito' : '', index === currentIndex && !finished ? 's7-estado--actual' : '']
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

/**
 * Motivo de um pedido Multicaixa Express recusado ou expirado, como chega da equipa de pagamentos ("Recusado pelo
 * cliente."), com o código do erro para o cliente indicar à loja se precisar de ajuda.
 */
function PaymentFailureReason({ payment }: { payment: OrderPaymentView }) {
  const unsuccessful = payment.status === 'FAILED' || payment.status === 'EXPIRED';
  if (!unsuccessful || (!payment.failureMessage && !payment.failureCode)) return null;
  return (
    <p className="s7-motivo">
      <span>Resposta do Multicaixa Express</span>
      <strong>{payment.failureMessage ?? 'Pagamento não concluído.'}</strong>
      {payment.failureCode && <small>Código {payment.failureCode}</small>}
    </p>
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
  } else if (payment.method === 'IBAN') {
    detail = payment.proofUploadedAt
      ? `Comprovativo recebido a ${formatDate(payment.proofUploadedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. A loja vai confirmar o pagamento de ${formatKz(amount)}.`
      : `Transfira ${formatKz(amount)} para o IBAN da loja e envie o comprovativo.`;
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
      {payment.method === 'MULTICAIXA_EXPRESS' && payment.status === 'PENDING' && payment.expiresAt && (
        <ExpressTimeLeft expiresAt={payment.expiresAt} />
      )}
      <PaymentFailureReason payment={payment} />
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
        {view.pickupPost && <p>Preparada {atPickupPost(view.pickupPost)}.</p>}
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
      <MapLink post={post} label="Ver no mapa" />
      {view.pickupDate && (
        <p>A partir de {formatDate(view.pickupDate, { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
      )}
    </section>
  );
}

/** Intervalo entre consultas enquanto o cliente confirma no Multicaixa Express (o seguimento aceita 30 por minuto). */
const EXPRESS_POLL_MS = 5000;
/** IBAN ou à espera de nova tentativa: a loja confirma à mão; de 15 em 15 segundos (só com o separador visível). */
const IBAN_POLL_MS = 15000;
/** Depois do prazo, a API ainda leva uns segundos a dar o pagamento como expirado; ao fim de 5 min deixa de se perguntar. */
const EXPRESS_POLL_GRACE_MS = 5 * 60 * 1000;
/** Paga e a caminho do levantamento: de minuto a minuto, para o "Levantei!" aparecer quando a loja a der como pronta. */
const PROGRESS_POLL_MS = 60 * 1000;

/** Paga e ainda por levantar (recebida, em preparação ou pronta): a loja vai mudando o estado. */
function awaitingPickup(order: ApiOrder | undefined): boolean {
  if (!order || order.payment?.status !== 'PAID') return false;
  return ![ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED].includes(order.status as typeof ORDER_STATUS.CANCELLED);
}

/** O cliente pode confirmar o levantamento: pronta para entrega e paga. */
function readyToConfirm(order: ApiOrder | undefined): boolean {
  return Boolean(order && order.status === ORDER_STATUS.READY && order.payment?.status === 'PAID');
}

/** IBAN ainda por confirmar pela loja: o cliente fica no passo "Aguarda pagamento" (transferência e comprovativo). */
function awaitingIbanPayment(order: ApiOrder | undefined): boolean {
  const payment = order?.payment;
  return Boolean(
    order && payment && payment.method === 'IBAN' && payment.status === 'PENDING' && order.status !== ORDER_STATUS.CANCELLED,
  );
}

/** Pedido Multicaixa Express por confirmar, numa encomenda por cancelar. */
function pendingExpress(order: ApiOrder | undefined): boolean {
  const payment = order?.payment;
  return Boolean(
    order &&
      payment &&
      payment.method === 'MULTICAIXA_EXPRESS' &&
      payment.status === 'PENDING' &&
      order.status !== ORDER_STATUS.CANCELLED,
  );
}

/** Instante (ms) em que `iso` acontece; null sem data ou com data inválida. */
function instant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Multicaixa Express ainda por confirmar: volta-se a perguntar à API até 5 minutos depois do fim do prazo (um
 * pagamento aceite no último segundo ainda pode chegar). `now` é a hora do servidor.
 */
function awaitingExpressPayment(order: ApiOrder | undefined, now: number): boolean {
  if (!pendingExpress(order)) return false;
  const end = instant(order?.payment?.expiresAt);
  return end === null || now < end + EXPRESS_POLL_GRACE_MS;
}

/** O prazo do pedido Express acabou e a API ainda não o deu como expirado (fá-lo de 15 em 15 segundos). */
function expressTimeUp(order: ApiOrder | undefined, now: number): boolean {
  const end = instant(order?.payment?.expiresAt);
  return pendingExpress(order) && end !== null && now >= end;
}

/** A encomenda ainda está reservada (`holdUntil`, definido pela API): o cliente pode pedir outro pagamento. */
function withinHold(order: ApiOrder | undefined, now: number): boolean {
  const end = instant(order?.payment?.holdUntil);
  if (!order || end === null || order.status === ORDER_STATUS.CANCELLED || order.payment?.status === 'PAID') return false;
  return now < end;
}

/**
 * Pedido Multicaixa Express recusado, expirado ou com o prazo acabado, e a encomenda ainda reservada: o cliente
 * pede outro pagamento logo no fim da contagem, sem esperar que a API marque o pedido como expirado (a API aceita
 * uma nova tentativa assim que o prazo do pedido actual termina).
 */
function canRetryPayment(order: ApiOrder | undefined, now: number): boolean {
  const payment = order?.payment;
  if (!payment || payment.method !== 'MULTICAIXA_EXPRESS' || !withinHold(order, now)) return false;
  return payment.status === 'FAILED' || payment.status === 'EXPIRED' || expressTimeUp(order, now);
}

/** "sábado, 18 de novembro, às 19:30". */
function formatHold(iso: string): string {
  return formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function OrderSummary({ view }: { view: OrderView }) {
  return (
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
  );
}

/**
 * Passo "Aguarda pagamento" do Multicaixa Express: a API enviou o pedido de pagamento (fila compra.online) e a página
 * espera que o cliente o aceite na aplicação. A contagem vem de `expiresAt` (5 minutos, na API) e de `now`, a hora do
 * servidor actualizada a cada segundo pelo OrderLoader: recarregar a página não a reinicia, e um relógio do dispositivo
 * desacertado não a muda. O OrderLoader volta a pedir a encomenda a cada EXPRESS_POLL_MS; quando o pagamento é
 * confirmado, falha ou o tempo acaba, a página passa sozinha para o passo seguinte.
 */
function ExpressPaymentWait({ view, now }: { view: OrderView; now: number }) {
  const { payment } = view;
  const amount = payment.amount ?? view.total;
  const end = instant(payment.expiresAt);
  const expressWindow = useExpressWindow();
  // A hora do servidor é medida ao segundo: nunca mais do que o prazo do pedido ("5:01").
  const secondsLeft = end === null ? null : Math.min(expressWindow.seconds, Math.max(0, Math.ceil((end - now) / 1000)));
  const overdue = secondsLeft === 0;
  const phone = payment.phone ? formatPhone(payment.phone) : null;
  // A contagem também no separador, para quem muda de janela.
  useDocumentTitle(secondsLeft ? `${formatCountdown(secondsLeft)} · Confirme o pagamento` : 'Aguarda pagamento');

  return (
    <>
      <OrderStepsBar view={view} current="pagamento" />

      <header className="s7-confirmacao">
        <span className="s7-confirmacao__ico">
          <Icon name="telemovel" />
        </span>
        <div>
          <h1>Confirme o pagamento no telemóvel</h1>
          <p>
            Enviámos um pedido de pagamento de {formatKz(amount)} para o Multicaixa Express
            {phone ? ` do número ${phone}` : ''}. Abra a aplicação e aceite o pagamento.
          </p>
        </div>
        {view.compraRef && (
          <p className="s7-confirmacao__ref">
            <span>Referência da compra</span>
            <b>{view.compraRef}</b>
          </p>
        )}
      </header>

      <div className="s7-encomenda">
        <div className="s7-encomenda__col">
          <section className="s7-bloco s7-espera" aria-labelledby="s7-espera-titulo">
            <h2 id="s7-espera-titulo">A aguardar o pagamento</h2>
            <p className="s7-espera__estado" role="status">
              <span className="s7-espera__pulso" aria-hidden="true" />
              {overdue
                ? 'O prazo terminou. A confirmar o estado do pagamento…'
                : 'Ainda não recebemos a confirmação. Esta página actualiza-se sozinha.'}
            </p>
            {secondsLeft !== null && !overdue && payment.expiresAt && (
              <ExpressCountdown secondsLeft={secondsLeft} expiresAt={payment.expiresAt} />
            )}
            <ol className="s7-espera__passos">
              <li>Abra a aplicação Multicaixa Express{phone ? ` do número ${phone}` : ''}.</li>
              <li>
                Aceite o pagamento de {formatKz(amount)}
                {view.compraRef ? `, com a referência ${view.compraRef}` : ''}.
              </li>
              <li>Volte a esta página: a confirmação aparece aqui e no seu e-mail.</li>
            </ol>
            <p className="s7-bloco__nota">
              <Icon name="relogio" />
              <span>
                {payment.holdUntil
                  ? `Se não aceitar a tempo, pode pedir outra vez o pagamento ou pagar por transferência bancária. A encomenda fica reservada até ${formatHold(payment.holdUntil)}.`
                  : 'Se o pagamento não for aceite dentro do prazo, a encomenda é cancelada e os artigos voltam a ficar disponíveis.'}
              </span>
            </p>
          </section>
        </div>
        <OrderSummary view={view} />
      </div>
    </>
  );
}

/**
 * Pedido Multicaixa Express recusado ou expirado, com a encomenda ainda reservada: o cliente pede outro pagamento
 * (mesmo ou outro telemóvel) ou muda para transferência bancária. Vale o primeiro pagamento confirmado; quando a
 * reserva termina sem pagamento, a API cancela a encomenda.
 */
function PaymentRetry({ view, onRetried }: { view: OrderView; onRetried: (order: ApiOrder, phone?: string) => void }) {
  useDocumentTitle('Pagamento não concluído');
  const { options } = useCheckoutOptions();
  const { payment } = view;
  const amount = payment.amount ?? view.total;
  // PENDING: o prazo acabou e a API ainda não marcou o pedido como expirado.
  const expired = payment.status !== 'FAILED';
  const checking = payment.status === 'PENDING';
  const ibanAvailable = options.paymentMethods.includes('IBAN');

  return (
    <>
      <OrderStepsBar view={view} current="pagamento" />

      <header className="s7-confirmacao s7-confirmacao--aviso">
        <span className="s7-confirmacao__ico">
          <Icon name="alerta" />
        </span>
        <div>
          <h1>{expired ? 'O tempo para aceitar terminou' : 'O pagamento não foi concluído'}</h1>
          <p>
            {expired
              ? 'O pedido de pagamento no Multicaixa Express não foi aceite a tempo.'
              : 'O pedido de pagamento no Multicaixa Express foi recusado ou não foi possível concluí-lo.'}{' '}
            {payment.holdUntil && <>A encomenda continua reservada até {formatHold(payment.holdUntil)}.</>}
          </p>
          <PaymentFailureReason payment={payment} />
        </div>
        {view.compraRef && (
          <p className="s7-confirmacao__ref">
            <span>Referência da compra</span>
            <b>{view.compraRef}</b>
          </p>
        )}
      </header>

      <div className="s7-encomenda">
        <div className="s7-encomenda__col">
          <section className="s7-bloco s7-espera" aria-labelledby="s7-repetir-titulo">
            <h2 id="s7-repetir-titulo">Tentar outra vez com Multicaixa Express</h2>
            {checking && (
              <p className="s7-espera__estado" role="status">
                <span className="s7-espera__pulso" aria-hidden="true" />
                Se aceitou o pagamento nos últimos segundos, a confirmação aparece aqui sozinha.
              </p>
            )}
            <p>Enviamos um novo pedido de pagamento de {formatKz(amount)} para o telemóvel que indicar.</p>
            <ExpressRetryForm
              orderId={view.id}
              initialPhone={payment.phone}
              submitLabel="Enviar novo pedido de pagamento"
              onDone={onRetried}
            />
          </section>

          {ibanAvailable && (
            <section className="s7-bloco s7-espera" aria-labelledby="s7-mudar-iban-titulo">
              <h2 id="s7-mudar-iban-titulo">Ou pague por transferência bancária</h2>
              <p>Mostramos o IBAN da loja e envia o comprovativo (PDF ou imagem) nesta página.</p>
              <IbanSwitchButton orderId={view.id} onDone={onRetried} />
            </section>
          )}
        </div>
        <OrderSummary view={view} />
      </div>
    </>
  );
}

/**
 * Passo "Aguarda pagamento" da transferência bancária: os dados do IBAN (definições da loja, em
 * GET /checkout/options) e o envio do comprovativo (PDF ou imagem). A loja confirma o pagamento no back-office;
 * o OrderLoader volta a pedir a encomenda a cada IBAN_POLL_MS.
 */
interface IbanPaymentWaitProps {
  view: OrderView;
  onUploaded: (payment: OrderPayment) => void;
  /** Com a encomenda reservada e o seguimento da API: o cliente pode antes pagar por Multicaixa Express. */
  onRetried?: (order: ApiOrder, phone?: string) => void;
}

function IbanPaymentWait({ view, onUploaded, onRetried }: IbanPaymentWaitProps) {
  useDocumentTitle('Aguarda pagamento');
  const expressWindow = useExpressWindow();
  const { state } = useLocation();
  const { options } = useCheckoutOptions();
  const bank = options.bankTransfer;
  const { payment } = view;
  const amount = payment.amount ?? view.total;
  const sent = payment.proofUploadedAt;
  const [file, setFile] = useState<File | null>(null);
  // Comprovativo escolhido no checkout que não chegou a ser enviado: a encomenda existe, falta só o ficheiro.
  const [error, setError] = useState<string | null>(() => {
    const failed = (state as { proofError?: string | null } | null)?.proofError;
    if (!failed || sent) return null;
    const reason = /[.!?]$/.test(failed) ? failed : `${failed}.`;
    return `A encomenda ficou registada, mas o comprovativo não foi enviado: ${reason} Escolha-o outra vez e envie.`;
  });
  const upload = useMutation({
    mutationFn: (proof: File) => uploadPaymentProof(view.id, proof),
    onSuccess: (result) => {
      setFile(null);
      setError(null);
      onUploaded(result);
    },
    onError: (failure) => setError(getApiErrorMessage(failure, 'Não foi possível enviar o comprovativo. Tente novamente.')),
  });

  const choose = (chosen: File | null) => {
    setError(null);
    setFile(null);
    if (!chosen) return;
    const problem = checkProofFile(chosen);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(chosen);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Escolha o comprovativo da transferência.');
      return;
    }
    upload.mutate(file);
  };

  return (
    <>
      <OrderStepsBar view={view} current="pagamento" />

      <header className="s7-confirmacao">
        <span className="s7-confirmacao__ico">
          <Icon name="recibo" />
        </span>
        <div>
          <h1>{sent ? 'Comprovativo recebido' : 'Transfira e envie o comprovativo'}</h1>
          <p>
            {sent
              ? 'A loja vai verificar a transferência e confirmar o pagamento. Recebe um e-mail quando estiver confirmado.'
              : `Faça a transferência de ${formatKz(amount)} para o IBAN abaixo e envie o comprovativo nesta página.`}
          </p>
        </div>
        {view.compraRef && (
          <p className="s7-confirmacao__ref">
            <span>Referência da compra</span>
            <b>{view.compraRef}</b>
          </p>
        )}
      </header>

      <div className="s7-encomenda">
        <div className="s7-encomenda__col">
          <section className="s7-bloco" aria-labelledby="s7-iban-titulo">
            <h2 id="s7-iban-titulo">Dados para a transferência</h2>
            {bank ? (
              <BankTransferList bank={bank} amount={amount} reference={view.compraRef} />
            ) : (
              <p>Os dados para a transferência estão no e-mail de confirmação da encomenda.</p>
            )}
            {view.compraRef && (
              <p className="s7-bloco__nota">
                <Icon name="alerta" />
                <span>
                  Escreva a referência <strong>{view.compraRef}</strong> na descrição da transferência: é assim que a
                  loja identifica o seu pagamento.
                </span>
              </p>
            )}
          </section>

          <section className="s7-bloco s7-espera" aria-labelledby="s7-comprovativo-titulo">
            <h2 id="s7-comprovativo-titulo">Comprovativo</h2>
            <p className="s7-espera__estado" role="status">
              <span className="s7-espera__pulso" aria-hidden="true" />
              {sent
                ? `Recebido a ${formatDate(sent, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}${payment.proofFileName ? ` (${payment.proofFileName})` : ''}. A aguardar a confirmação da loja.`
                : 'Ainda não recebemos o comprovativo.'}
            </p>
            <form className="s7-comprovativo" noValidate onSubmit={submit}>
              <div className={error ? 's7-campo s7-campo--erro' : 's7-campo'}>
                <label htmlFor="s7-comprovativo">{sent ? 'Enviar outro comprovativo' : 'Comprovativo da transferência'}</label>
                <ProofFileInput
                  id="s7-comprovativo"
                  file={file}
                  invalid={Boolean(error)}
                  describedBy="s7-comprovativo-ajuda s7-comprovativo-erro"
                  onChange={choose}
                />
                <p className="s7-campo__ajuda" id="s7-comprovativo-ajuda">
                  {PROOF_HELP}
                </p>
                <p className="s7-campo__erro" id="s7-comprovativo-erro" role="alert">
                  {error}
                </p>
              </div>
              <button className="s7-btn s7-btn--primario" type="submit" disabled={upload.isPending || !file}>
                {upload.isPending ? 'A enviar…' : sent ? 'Substituir comprovativo' : 'Enviar comprovativo'}
              </button>
            </form>
            <p className="s7-bloco__nota">
              <Icon name="relogio" />
              <span>A encomenda fica reservada enquanto a loja confirma o pagamento. Esta página actualiza-se sozinha.</span>
            </p>
          </section>

          {onRetried && options.paymentMethods.includes('MULTICAIXA_EXPRESS') && (
            <section className="s7-bloco s7-espera" aria-labelledby="s7-mudar-express-titulo">
              <h2 id="s7-mudar-express-titulo">Prefere pagar com Multicaixa Express?</h2>
              <p>
                {sent
                  ? 'Já enviou o comprovativo: só pague por Multicaixa Express se ainda não fez a transferência. Vale o primeiro pagamento confirmado.'
                  : `Enviamos um pedido de pagamento para o seu telemóvel; aceita-o na aplicação em ${expressWindow.label}.`}
              </p>
              <ExpressRetryForm
                orderId={view.id}
                initialPhone={payment.phone}
                submitLabel="Pagar com Multicaixa Express"
                onDone={onRetried}
              />
            </section>
          )}
        </div>
        <OrderSummary view={view} />
      </div>
    </>
  );
}

/**
 * Encomenda pronta a levantar (ou a caminho), paga: o cliente confirma aqui que a levantou ("Levantei!"). Pede uma
 * segunda confirmação, porque o passo não volta atrás; a API passa a encomenda a Entregue.
 */
function ReceiptConfirmation({ view, onConfirmed }: { view: OrderView; onConfirmed: (order: ApiOrder) => void }) {
  const home = view.deliveryType === 'HOME_DELIVERY';
  const { data: posts } = usePickupPosts();
  const post = posts?.find((item) => item.id === view.pickupPostId);
  const [asking, setAsking] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);
  const confirm = useMutation({
    mutationFn: () => confirmOrderReceived(view.id),
    onSuccess: onConfirmed,
  });
  useEffect(() => {
    if (asking) yesRef.current?.focus();
  }, [asking]);
  const where = view.pickupPost ? atPickupPost(view.pickupPost) : 'na loja Super7';

  return (
    <section className="s7-bloco s7-levantar" aria-labelledby="s7-levantar-titulo">
      <span className="s7-levantar__ico" aria-hidden="true">
        <Icon name={home ? 'camiao' : 'loja'} />
      </span>
      <div className="s7-levantar__texto">
        <h2 id="s7-levantar-titulo">{home ? 'A sua encomenda está a caminho' : 'A sua encomenda está pronta'}</h2>
        <p>
          {home
            ? 'Quando a receber, confirme aqui.'
            : `Levante-a ${where}${view.compraRef ? ` com a referência ${view.compraRef}` : ''}. Depois de a levantar, confirme aqui.`}
        </p>
        {!home && <MapLink post={post} label="Ver no mapa" />}
      </div>
      <div className="s7-levantar__accoes">
        {asking ? (
          <>
            <p className="s7-levantar__pergunta" id="s7-levantar-pergunta">
              {home ? 'Já tem a encomenda consigo?' : 'Já levantou a encomenda?'}
            </p>
            <button
              ref={yesRef}
              type="button"
              className="s7-btn s7-btn--primario"
              aria-describedby="s7-levantar-pergunta"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? 'A confirmar…' : home ? 'Sim, recebi' : 'Sim, levantei'}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--contorno"
              disabled={confirm.isPending}
              onClick={() => {
                setAsking(false);
                confirm.reset();
              }}
            >
              Ainda não
            </button>
          </>
        ) : (
          <button type="button" className="s7-btn s7-btn--primario s7-btn--grande" onClick={() => setAsking(true)}>
            <Icon name="check" />
            <span>{home ? 'Recebi!' : 'Levantei!'}</span>
          </button>
        )}
      </div>
      {confirm.isError && (
        <p className="s7-levantar__erro" role="alert">
          {getApiErrorMessage(confirm.error, 'Não foi possível confirmar agora. Tente novamente dentro de alguns minutos.')}
        </p>
      )}
    </section>
  );
}

interface OrderDetailsProps {
  view: OrderView;
  fromDevice: boolean;
  /** Com a encomenda pronta e paga, e a API que o suporta: o cliente confirma o levantamento ("Levantei!"). */
  onConfirmReceived?: (order: ApiOrder) => void;
}

function OrderDetails({ view, fromDevice, onConfirmReceived }: OrderDetailsProps) {
  const { state } = useLocation();
  const justPlaced = Boolean((state as { placed?: boolean } | null)?.placed);
  const cancelled = view.status === ORDER_STATUS.CANCELLED;
  const delivered = view.status === ORDER_STATUS.DELIVERED;
  const firstName = view.customer.fullName.split(' ')[0];
  useDocumentTitle(`Encomenda ${shortOrderId(view.id)}`);

  let lead: string;
  if (justPlaced) {
    lead = `Obrigado${firstName ? `, ${firstName}` : ''}! Enviámos a confirmação para ${view.customer.email}.`;
  } else if (delivered && view.customerConfirmedAt) {
    lead = `Confirmou ${view.deliveryType === 'HOME_DELIVERY' ? 'a entrega' : 'o levantamento'} a ${formatMoment(view.customerConfirmedAt)}. Obrigado pela preferência!`;
  } else {
    lead = `Registada a ${formatDate(view.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}${view.customer.fullName ? ` em nome de ${view.customer.fullName}` : ''}.`;
  }

  return (
    <>
      <OrderStepsBar view={view} />

      <header className={cancelled ? 's7-confirmacao s7-confirmacao--cancelada' : 's7-confirmacao'}>
        <span className="s7-confirmacao__ico">
          <Icon name={cancelled ? 'alerta' : 'check'} />
        </span>
        <div>
          <h1>{orderTitle(view)}</h1>
          <p>{lead}</p>
        </div>
        <p className="s7-confirmacao__ref">
          <span>N.º da encomenda</span>
          <b>{view.id}</b>
          {view.compraRef && (
            <>
              <span>Referência da compra</span>
              <b>{view.compraRef}</b>
            </>
          )}
        </p>
      </header>

      <div className="s7-encomenda">
        <div className="s7-encomenda__col">
          {onConfirmReceived && <ReceiptConfirmation view={view} onConfirmed={onConfirmReceived} />}
          <section className="s7-bloco" aria-labelledby="s7-estado-titulo">
            <h2 id="s7-estado-titulo">Estado da encomenda</h2>
            {cancelled ? (
              <p>
                Esta encomenda foi cancelada. Se tiver dúvidas, fale connosco
                {view.pickupPost ? ` ${atPickupPost(view.pickupPost)}` : ''} ou responda ao e-mail que recebeu.
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

        <OrderSummary view={view} />
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
  const { receiptConfirmation } = useCheckoutOptions().options;
  const [local, setLocal] = useState(() => getLocalOrder(id));
  // Quem fez a encomenda neste dispositivo vê os passos do pagamento, mesmo com sessão iniciada no back-office.
  const customer = !staff || local !== null;
  const queryClient = useQueryClient();
  const queryKey = ['order', id, staff ? 'equipa' : 'seguimento'];

  // A equipa vê a encomenda completa; o cliente usa o seguimento público quando existir
  // (`api_features=order-tracking`) e, até lá, a cópia guardada no checkout.
  const remote = useQuery({
    queryKey,
    queryFn: () => (staff ? fetchOrder(id) : fetchOrderTracking(id)),
    enabled: staff || tracking,
    retry: false,
    // Multicaixa Express: volta a perguntar até o pagamento ser confirmado, falhar ou expirar. Com IBAN ou à espera
    // de uma nova tentativa, de 15 em 15 segundos (um pagamento atrasado ainda pode chegar).
    refetchInterval: (query) => {
      const now = serverNow();
      if (awaitingExpressPayment(query.state.data, now)) return EXPRESS_POLL_MS;
      if (awaitingIbanPayment(query.state.data) || canRetryPayment(query.state.data, now)) return IBAN_POLL_MS;
      return awaitingPickup(query.state.data) ? PROGRESS_POLL_MS : false;
    },
  });
  const { refetch } = remote;

  // Enquanto há pagamento por fazer, a página conta os segundos na hora do servidor (ponteiro do Express, fim do prazo,
  // fim da reserva). Também à espera de nova tentativa e no IBAN: um novo pedido Express começa logo com a hora certa.
  const remotePayment = remote.data?.payment;
  const unpaid = Boolean(
    remotePayment &&
      remotePayment.status !== 'PAID' &&
      remotePayment.method !== 'IN_STORE' &&
      remote.data?.status !== ORDER_STATUS.CANCELLED,
  );
  const now = useServerNow(1000, unpaid);
  const timeUp = expressTimeUp(remote.data, now);
  // No fim do prazo pergunta logo à API: um pagamento aceite no último segundo aparece sem esperar pela consulta.
  useEffect(() => {
    if (timeUp) void refetch();
  }, [timeUp, refetch]);

  // Pagamento confirmado enquanto a página está aberta (Express aceite no telemóvel, IBAN confirmado pela loja):
  // aparece a janela "Pago". Quem abre a página de uma encomenda já paga não a vê.
  const paymentStatus = remotePayment?.status;
  const [seenStatus, setSeenStatus] = useState(paymentStatus);
  const [paidNotice, setPaidNotice] = useState(false);
  if (paymentStatus !== seenStatus) {
    setSeenStatus(paymentStatus);
    if (paymentStatus === 'PAID' && seenStatus !== undefined) setPaidNotice(true);
  }

  // Novo pedido de pagamento (Express outra vez ou IBAN): a resposta já traz o pagamento actualizado. O seguimento não
  // devolve o telemóvel, por isso o do novo pedido Express fica na cópia local.
  const onRetried = (updated: ApiOrder, phone?: string) => {
    const payment = updated.payment && phone ? { ...updated.payment, phone } : updated.payment;
    queryClient.setQueryData(queryKey, { ...updated, payment });
    if (payment) {
      const saved = updateLocalOrderPayment(id, payment, {
        paymentMethod: payment.method,
        ...(phone ? { paymentPhone: phone } : {}),
      });
      if (saved) setLocal(saved);
    }
  };

  // "Levantei!": a resposta traz a encomenda como no seguimento; volta-se a pedi-la para a equipa ver os dados todos.
  const onReceived = (updated: ApiOrder) => {
    queryClient.setQueryData(queryKey, updated);
    void refetch();
  };

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
  const view = toOrderView(merged, local?.extras ?? null);
  let screen;
  // Só com o estado vindo da API (que se vai actualizando): a cópia local fica sempre "pendente".
  // Pedido Express recusado, expirado ou com o tempo acabado, com a encomenda reservada: repetir ou mudar para IBAN.
  if (customer && remote.data && canRetryPayment(remote.data, now)) {
    screen = <PaymentRetry view={view} onRetried={onRetried} />;
  } else if (customer && remote.data && awaitingExpressPayment(remote.data, now)) {
    screen = <ExpressPaymentWait view={view} now={now} />;
  } else if (customer && awaitingIbanPayment(remote.data ?? local?.order)) {
    // IBAN: mesmo sem o seguimento da API (cópia local), o cliente tem de poder enviar o comprovativo.
    // Depois do envio, a cópia local passa a ter o comprovativo (sem o seguimento da API, é a única fonte).
    const onUploaded = (payment: OrderPayment) => {
      const updated = updateLocalOrderPayment(id, payment);
      if (updated) setLocal(updated);
      if (staff || tracking) void refetch();
    };
    screen = (
      <IbanPaymentWait
        view={view}
        onUploaded={onUploaded}
        onRetried={remote.data && withinHold(remote.data, now) ? onRetried : undefined}
      />
    );
  } else {
    screen = (
      <OrderDetails
        view={view}
        fromDevice={!remote.data}
        onConfirmReceived={customer && receiptConfirmation && readyToConfirm(remote.data) ? onReceived : undefined}
      />
    );
  }

  return (
    <>
      {screen}
      {paidNotice && customer && (
        <PaidDialog
          amount={view.payment.amount ?? view.total}
          method={view.payment.method}
          reference={view.compraRef}
          onClose={() => setPaidNotice(false)}
        />
      )}
    </>
  );
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
