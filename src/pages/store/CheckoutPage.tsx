import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage, getApiErrorMessages, getApiStatus } from '../../api/client';
import { createOrder, uploadPaymentProof } from '../../api/orders';
import { pickupPostDetails } from '../../api/pickupPosts';
import { buildOrderNotes, isValidEmail, isValidMobile, normalisePhone, tomorrowIsoDate } from '../../catalog/checkout';
import { saveLocalOrder } from '../../catalog/localOrders';
import { CATALOG_QUERY_KEY } from '../../catalog/useCatalog';
import { useCampaigns, useCheckoutOptions } from '../../catalog/useStoreSettings';
import { checkProofFile, PROOF_HELP } from '../../catalog/paymentProof';
import { BankTransferList, ProofFileInput } from '../../components/store/BankTransfer';
import { CheckoutSteps } from '../../components/store/CheckoutSteps';
import { Breadcrumbs, CatalogError, EmptyState } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { MapLink } from '../../components/store/MapLink';
import { ProductImage } from '../../components/store/ProductBits';
import type { IconName } from '../../catalog/types';
import {
  CHECKOUT_LIMITS,
  hasApiFeature,
  PAYMENT_METHOD_LABELS,
  type DeliveryType,
  type PaymentMethod,
} from '../../config/store';
import { useCart } from '../../context/cart';
import { useCartDetail } from '../../hooks/useCartDetail';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { usePickupPosts } from '../../hooks/usePickupPosts';
import type { OrderRequest } from '../../types/api';
import { formatDate, formatKz, plural } from '../../utils/format';
import { trackMetaPurchase } from '../../utils/metaPixel';

interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  nif: string;
  delivery: DeliveryType;
  pickupPostId: string;
  pickupDate: string;
  address: string;
  district: string;
  addressReference: string;
  observations: string;
  gift: boolean;
  recipient: string;
  giftMessage: string;
  paymentMethod: PaymentMethod;
  paymentPhone: string;
  /** IBAN: comprovativo da transferência, opcional (também se pode enviar depois, na página da encomenda). */
  paymentProof: File | null;
}

type FieldName =
  | 'fullName' | 'phone' | 'email' | 'nif' | 'pickupPostId' | 'pickupDate' | 'address' | 'district'
  | 'addressReference' | 'observations' | 'recipient' | 'giftMessage' | 'paymentPhone' | 'paymentProof';
type FieldErrors = Partial<Record<FieldName, string>>;

/** Ordem dos campos no ecrã: o foco vai para o primeiro com erro. */
const FIELD_ORDER: FieldName[] = [
  'fullName', 'phone', 'email', 'nif', 'pickupPostId', 'pickupDate', 'address', 'district',
  'addressReference', 'observations', 'recipient', 'giftMessage', 'paymentPhone', 'paymentProof',
];

const fieldId = (name: FieldName) => `s7-${name}`;

/** Como no layout: Multicaixa Express escolhido à partida (se estiver nas opções). */
const DEFAULT_PAYMENT: PaymentMethod = 'MULTICAIXA_EXPRESS';

const PAYMENT_OPTIONS: Record<PaymentMethod, { icon: IconName; note: string }> = {
  MULTICAIXA_EXPRESS: { icon: 'telemovel', note: 'Confirma o pagamento na aplicação, em {prazo}' },
  IBAN: { icon: 'recibo', note: 'Transfere e envia o comprovativo (PDF ou imagem)' },
  REFERENCE: { icon: 'cartao', note: 'Num Multicaixa ou no homebanking' },
  IN_STORE: { icon: 'dinheiro', note: 'No acto do levantamento' },
};

interface DateLimits {
  min: string;
  max: string | null;
}

interface Context {
  dates: DateLimits;
  delivery: DeliveryType;
  /** null quando a loja não tem nenhum pagamento disponível. */
  paymentMethod: PaymentMethod | null;
  /** Loja fixa (definições da loja): o cliente não escolhe. */
  fixedPostId: string | null;
}

function validate(form: CheckoutForm, context: Context): FieldErrors {
  const errors: FieldErrors = {};
  const { dates, delivery, paymentMethod } = context;

  if (!form.fullName.trim()) errors.fullName = 'Indique o seu nome.';
  if (!isValidMobile(form.phone)) errors.phone = 'Indique um número de telemóvel com 9 dígitos, começado por 9.';
  if (!form.email.trim()) errors.email = 'Indique o e-mail para receber a confirmação.';
  else if (!isValidEmail(form.email)) errors.email = 'Verifique o endereço de e-mail.';

  if (!context.fixedPostId && !form.pickupPostId) {
    errors.pickupPostId = delivery === 'PICKUP' ? 'Escolha a loja onde quer levantar.' : 'Escolha a loja mais próxima da morada.';
  }
  if (delivery === 'PICKUP') {
    if (!form.pickupDate || form.pickupDate < dates.min || (dates.max && form.pickupDate > dates.max)) {
      errors.pickupDate = dates.max
        ? `Escolha uma data entre ${formatDate(dates.min)} e ${formatDate(dates.max)}.`
        : `Escolha uma data a partir de ${formatDate(dates.min)}.`;
    }
  } else {
    if (!form.address.trim()) errors.address = 'Indique a morada de entrega.';
    if (!form.district.trim()) errors.district = 'Indique o bairro ou município.';
  }

  if (form.gift && !form.recipient.trim()) errors.recipient = 'Indique para quem é a oferta.';
  if (paymentMethod === 'MULTICAIXA_EXPRESS' && !isValidMobile(form.paymentPhone)) {
    errors.paymentPhone = 'Indique o número associado ao Multicaixa Express.';
  }
  if (paymentMethod === 'IBAN' && form.paymentProof) {
    const problem = checkProofFile(form.paymentProof);
    if (problem) errors.paymentProof = problem;
  }

  return errors;
}

interface FieldProps {
  name: FieldName;
  label: ReactNode;
  error?: string;
  help?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

function Field({ name, label, error, help, wide = false, children }: FieldProps) {
  const classes = ['s7-campo'];
  if (wide) classes.push('s7-campo--largo');
  if (error) classes.push('s7-campo--erro');

  return (
    <div className={classes.join(' ')}>
      <label htmlFor={fieldId(name)}>{label}</label>
      {children}
      {help && (
        <p className="s7-campo__ajuda" id={`${fieldId(name)}-ajuda`}>
          {help}
        </p>
      )}
      <p className="s7-campo__erro" id={`${fieldId(name)}-erro`}>
        {error}
      </p>
    </div>
  );
}

interface OptionCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  icon: IconName;
  title: string;
  note: ReactNode;
}

function OptionCard({ name, value, checked, onChange, icon, title, note }: OptionCardProps) {
  return (
    <label className="s7-opcao">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="s7-opcao__caixa">
        <Icon name={icon} />
        <span>
          <strong>{title}</strong>
          <small>{note}</small>
        </span>
      </span>
    </label>
  );
}

export function CheckoutPage() {
  useDocumentTitle('Finalizar compra');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lines, clear } = useCart();
  const { detail, isLoading, isError, refetch } = useCartDetail();
  const pickupPosts = usePickupPosts();
  const { campaigns, isActive } = useCampaigns();
  const { options } = useCheckoutOptions();
  const expressWindow = plural(options.expressValidityMinutes, 'minuto', 'minutos');
  const mutation = useMutation({ mutationFn: createOrder });
  const [sendingProof, setSendingProof] = useState(false);

  const [minDate] = useState(tomorrowIsoDate);
  const christmas = campaigns.natal;
  const dates: DateLimits = {
    min: minDate,
    max: isActive('natal') && christmas.endsOn >= minDate ? christmas.endsOn : null,
  };

  const [form, setForm] = useState<CheckoutForm>(() => ({
    fullName: '',
    phone: '',
    email: '',
    nif: '',
    delivery: 'PICKUP',
    pickupPostId: '',
    pickupDate: minDate,
    address: '',
    district: '',
    addressReference: '',
    observations: '',
    gift: false,
    recipient: '',
    giftMessage: '',
    paymentMethod: DEFAULT_PAYMENT,
    paymentPhone: '',
    paymentProof: null,
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  /*
   * Opções efectivas (definições da loja): Multicaixa Express e/ou IBAN, ambos pagos antes; a entrega ao domicílio
   * precisa de um deles. Com loja fixa, o cliente não escolhe a loja.
   */
  const onlineMethods = options.paymentMethods.filter((method) => method !== 'IN_STORE');
  const homeDeliveryAvailable = options.homeDelivery.enabled && onlineMethods.length > 0;
  const fixedPostId = options.pickup.mode === 'FIXED' ? options.pickup.fixedPostId : null;
  const contextFor = (values: CheckoutForm): Context => {
    const chosenDelivery: DeliveryType = values.delivery === 'HOME_DELIVERY' && homeDeliveryAvailable ? 'HOME_DELIVERY' : 'PICKUP';
    const allowed = chosenDelivery === 'HOME_DELIVERY' ? onlineMethods : options.paymentMethods;
    const method = allowed.includes(values.paymentMethod) ? values.paymentMethod : allowed[0] ?? null;
    return { dates, delivery: chosenDelivery, paymentMethod: method, fixedPostId };
  };
  const context = contextFor(form);
  const { delivery, paymentMethod } = context;
  const methods = delivery === 'HOME_DELIVERY' ? onlineMethods : options.paymentMethods;
  const deliveryFee = delivery === 'HOME_DELIVERY' ? options.homeDelivery.fee : 0;
  const total = detail.subtotal + deliveryFee;
  const giftAvailable = options.giftEnabled;
  const pickupPostId = fixedPostId ?? form.pickupPostId;

  const selectedPost = pickupPosts.data?.find((post) => post.id === pickupPostId) ?? null;
  const postInfo = pickupPostDetails(selectedPost);

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    const next = { ...form, [key]: value };
    // O telemóvel do Multicaixa Express acompanha o do cliente até ser alterado à mão.
    if (key === 'phone' && (!form.paymentPhone || form.paymentPhone === form.phone)) {
      next.paymentPhone = value as string;
    }
    setForm(next);

    // Os erros já mostrados desaparecem assim que ficam resolvidos (também por outro campo,
    // como o telemóvel que preenche o do Multicaixa Express). Erros novos só aparecem ao confirmar.
    if (Object.values(errors).some(Boolean)) {
      const fresh = validate(next, contextFor(next));
      setErrors((current) => {
        const still: FieldErrors = {};
        (Object.keys(current) as FieldName[]).forEach((name) => {
          if (current[name] && fresh[name]) still[name] = fresh[name];
        });
        return still;
      });
    }
  };

  const describedBy = (name: FieldName, help = false) =>
    [help ? `${fieldId(name)}-ajuda` : '', errors[name] ? `${fieldId(name)}-erro` : ''].filter(Boolean).join(' ') || undefined;

  const inputProps = (name: FieldName, help = false) => ({
    id: fieldId(name),
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': describedBy(name, help),
  });

  // O comprovativo é verificado logo ao escolher, largar ou remover (tipo e tamanho), sem esperar por "Confirmar
  // encomenda". Um ficheiro recusado fica à vista, com o erro, para se trocar.
  const chooseProof = (file: File | null) => {
    set('paymentProof', file);
    const problem = file ? checkProofFile(file) : null;
    setErrors((current) => ({ ...current, paymentProof: problem ?? undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || sendingProof || detail.lines.length === 0) return;

    const found = validate(form, context);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((name) => found[name]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    if (!paymentMethod) {
      setSubmitErrors(['Os pagamentos estão indisponíveis de momento. Tente novamente mais tarde.']);
      return;
    }

    const home = delivery === 'HOME_DELIVERY';
    const gift = giftAvailable && form.gift ? { recipient: form.recipient.trim(), message: form.giftMessage.trim() } : null;
    const deliveryAddress = home
      ? { address: form.address.trim(), district: form.district.trim(), reference: form.addressReference.trim() || null }
      : null;
    const paymentPhone = paymentMethod === 'MULTICAIXA_EXPRESS' ? normalisePhone(form.paymentPhone) : '';
    const nif = form.nif.trim();

    const notes = buildOrderNotes({
      deliveryType: delivery,
      pickupDate: home ? '' : form.pickupDate,
      deliveryAddress,
      deliveryFee,
      paymentMethod,
      paymentPhone,
      nif,
      gift,
      observations: form.observations,
      onlyObservations: hasApiFeature('order-fields'),
    });

    const payload: OrderRequest = {
      customer: {
        fullName: form.fullName.trim(),
        phone: normalisePhone(form.phone),
        email: form.email.trim(),
        // A API exige a localização: na entrega é o bairro; no levantamento, a zona da loja.
        location: home ? form.district.trim() : selectedPost?.zone || selectedPost?.name || 'Levantamento na loja',
        nif: nif || undefined,
      },
      pickupPostId,
      notes: notes || undefined,
      items: detail.lines.map((line) => ({ productId: line.product.id, quantity: line.qty })),
      // Campos propostos: a API actual ignora-os; ver docs/api-campos-em-falta.md.
      deliveryType: delivery,
      pickupDate: home ? undefined : form.pickupDate,
      deliveryAddress: deliveryAddress ?? undefined,
      gift: gift ?? undefined,
      paymentMethod,
      paymentPhone: paymentPhone || undefined,
    };

    setSubmitErrors([]);
    try {
      const order = await mutation.mutateAsync(payload);

      // IBAN com comprovativo: envia-o já. A encomenda existe mesmo que o envio falhe; nesse caso a página
      // da encomenda mostra o erro e deixa enviar outra vez.
      let placed = order;
      let proofError: string | null = null;
      const proof = paymentMethod === 'IBAN' ? form.paymentProof : null;
      if (proof) {
        setSendingProof(true);
        try {
          const payment = await uploadPaymentProof(order.id, proof);
          placed = { ...order, payment: { ...order.payment, ...payment } };
        } catch (error) {
          proofError = getApiErrorMessage(error, 'Não foi possível enviar o comprovativo.');
        } finally {
          setSendingProof(false);
        }
      }

      saveLocalOrder(placed, {
        deliveryType: delivery,
        pickupDate: home ? undefined : form.pickupDate,
        deliveryAddress: deliveryAddress ?? undefined,
        deliveryFee,
        paymentMethod,
        paymentPhone: paymentPhone || undefined,
        nif: nif || undefined,
        gift: gift ?? undefined,
      });
      trackMetaPurchase({
        value: order.deliveryFee != null ? Number(order.total) : Number(order.total ?? detail.subtotal) + deliveryFee,
        contentIds: detail.lines.map((line) => line.product.id),
        numItems: detail.units,
        orderId: order.id,
      });
      // O stock mudou: o catálogo volta a ser pedido à API.
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      navigate(`/encomenda/${order.id}`, { state: { placed: true, proofError } });
      clear();
    } catch (error) {
      setSubmitErrors(getApiErrorMessages(error, 'Não foi possível registar a encomenda. Tente novamente.'));
      // Produto indisponível ou sem stock: actualiza o catálogo para acertar o carrinho.
      if (getApiStatus(error) === 404) void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    }
  };

  const messageLeft = options.giftMessageMaxLength - form.giftMessage.length;
  const empty = lines.length === 0 || (!isLoading && !isError && detail.lines.length === 0);
  const posts = pickupPosts.data ?? [];

  const postSelect = (label: string, help?: string) =>
    fixedPostId ? (
      // Loja fixa (definições da loja): só informação.
      <div className="s7-campo">
        <span className="s7-campo__rotulo">{label}</span>
        <p className="s7-passo__info">
          <Icon name="loja" />
          <span>
            <strong>{selectedPost?.name ?? 'Loja Super7'}</strong>
            {postInfo && <> · {postInfo}</>}
            <MapLink post={selectedPost} label="Ver no mapa" />
          </span>
        </p>
      </div>
    ) : (
    <Field
      name="pickupPostId"
      label={label}
      error={pickupPosts.isError ? 'Não foi possível carregar as lojas.' : errors.pickupPostId}
      help={help}
    >
      <select
        {...inputProps('pickupPostId', Boolean(help))}
        required
        disabled={pickupPosts.isLoading}
        value={form.pickupPostId}
        onChange={(event) => set('pickupPostId', event.target.value)}
      >
        <option value="">{pickupPosts.isLoading ? 'A carregar lojas…' : 'Escolha a loja'}</option>
        {posts.map((post) => (
          <option key={post.id} value={post.id}>
            {post.zone ? `${post.name} · ${post.zone}` : post.name}
          </option>
        ))}
      </select>
      {pickupPosts.isError && (
        <button type="button" className="s7-ligacao" onClick={() => pickupPosts.refetch()}>
          Tentar novamente
        </button>
      )}
      <MapLink post={selectedPost} label={`Ver ${selectedPost?.name ?? 'a loja'} no mapa`} className="s7-mapa--campo" />
    </Field>
  );

  return (
    <main id="conteudo" className="s7-contentor">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Carrinho', to: '/carrinho' }, { label: 'Finalizar compra' }]} />

      <div className="s7-pagina-titulo">
        <div>
          <h1>Finalizar compra</h1>
        </div>
        <CheckoutSteps current="dados" />
      </div>

      {empty && submitErrors.length > 0 ? (
        // A API recusou a encomenda por falta de stock e o carrinho ficou vazio ao ser acertado.
        <EmptyState
          icon="alerta"
          title="Os produtos esgotaram entretanto"
          alert
          action={
            <Link className="s7-btn s7-btn--primario" to="/catalogo">
              Ver produtos disponíveis
            </Link>
          }
        >
          {submitErrors.map((message) => (/[.!?]$/.test(message) ? message : `${message}.`)).join(' ')} Retirámos do
          carrinho o que já não está disponível; nada foi encomendado.
        </EmptyState>
      ) : empty ? (
        <EmptyState
          icon="carrinho"
          title="Não há nada para finalizar"
          action={
            <Link className="s7-btn s7-btn--campanha" to={isActive('natal') ? '/catalogo?campanha=natal' : '/catalogo'}>
              {isActive('natal') ? 'Ver cestas de Natal' : 'Ver produtos'}
            </Link>
          }
        >
          O carrinho está vazio. Escolha primeiro os produtos que quer encomendar.
        </EmptyState>
      ) : isError ? (
        <CatalogError onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="s7-carregar" role="status">
          A preparar a sua encomenda…
        </p>
      ) : (
        <form className="s7-checkout" noValidate onSubmit={submit}>
          <div>
            {/* 1 · Dados */}
            <fieldset className="s7-passo">
              <legend>
                <b>1</b> Os seus dados
              </legend>
              <div className="s7-campos">
                <Field name="fullName" label="Nome completo" error={errors.fullName}>
                  <input {...inputProps('fullName')} type="text" autoComplete="name" required value={form.fullName} onChange={(event) => set('fullName', event.target.value)} />
                </Field>
                <Field name="phone" label="Telemóvel" error={errors.phone}>
                  <input
                    {...inputProps('phone')}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="9XX XXX XXX"
                    required
                    value={form.phone}
                    onChange={(event) => set('phone', event.target.value)}
                  />
                </Field>
                <Field name="email" label="E-mail" error={errors.email} help="Enviamos para aqui a confirmação e cada mudança de estado.">
                  <input {...inputProps('email', true)} type="email" autoComplete="email" required value={form.email} onChange={(event) => set('email', event.target.value)} />
                </Field>
                <Field
                  name="nif"
                  label={
                    <>
                      NIF <small>(opcional, para a factura)</small>
                    </>
                  }
                  error={errors.nif}
                >
                  <input
                    {...inputProps('nif')}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={CHECKOUT_LIMITS.nif}
                    value={form.nif}
                    onChange={(event) => set('nif', event.target.value)}
                  />
                </Field>
              </div>
            </fieldset>

            {/* 2 · Entrega */}
            <fieldset className="s7-passo">
              <legend>
                <b>2</b> Entrega
              </legend>
              <div className="s7-opcoes">
                <OptionCard
                  name="entrega"
                  value="PICKUP"
                  checked={delivery === 'PICKUP'}
                  onChange={() => set('delivery', 'PICKUP')}
                  icon="loja"
                  title="Levantar numa loja Super7"
                  note="Sem custo de entrega"
                />
                {homeDeliveryAvailable && (
                  <OptionCard
                    name="entrega"
                    value="HOME_DELIVERY"
                    checked={delivery === 'HOME_DELIVERY'}
                    onChange={() => set('delivery', 'HOME_DELIVERY')}
                    icon="camiao"
                    title="Entrega ao domicílio"
                    note={`${options.homeDelivery.zones.join(', ') || 'Na sua morada'} · ${formatKz(options.homeDelivery.fee)}`}
                  />
                )}
              </div>

              {delivery === 'PICKUP' ? (
                <div className="s7-passo__sub">
                  <div className="s7-campos">
                    {postSelect('Loja de levantamento', postInfo || undefined)}
                    <Field name="pickupDate" label="Data de levantamento" error={errors.pickupDate}>
                      <input
                        {...inputProps('pickupDate')}
                        type="date"
                        required
                        min={dates.min}
                        max={dates.max ?? undefined}
                        value={form.pickupDate}
                        onChange={(event) => set('pickupDate', event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="s7-passo__sub">
                  <div className="s7-campos">
                    <Field name="address" label="Morada de entrega" error={errors.address} wide>
                      <input
                        {...inputProps('address')}
                        type="text"
                        autoComplete="street-address"
                        maxLength={CHECKOUT_LIMITS.address}
                        required
                        value={form.address}
                        onChange={(event) => set('address', event.target.value)}
                      />
                    </Field>
                    <Field name="district" label="Bairro / município" error={errors.district}>
                      <input
                        {...inputProps('district')}
                        type="text"
                        autoComplete="address-level2"
                        maxLength={CHECKOUT_LIMITS.district}
                        required
                        value={form.district}
                        onChange={(event) => set('district', event.target.value)}
                      />
                    </Field>
                    <Field
                      name="addressReference"
                      label={
                        <>
                          Ponto de referência <small>(opcional)</small>
                        </>
                      }
                      error={errors.addressReference}
                    >
                      <input
                        {...inputProps('addressReference')}
                        type="text"
                        maxLength={CHECKOUT_LIMITS.addressReference}
                        value={form.addressReference}
                        onChange={(event) => set('addressReference', event.target.value)}
                      />
                    </Field>
                    {postSelect('Loja Super7 mais próxima', 'É a loja que prepara e envia a encomenda.')}
                  </div>
                </div>
              )}

              <div className="s7-passo__sub">
                <div className="s7-campos">
                  <Field
                    name="observations"
                    label={
                      <>
                        Observações <small>(opcional)</small>
                      </>
                    }
                    error={errors.observations}
                    wide
                  >
                    <input
                      {...inputProps('observations')}
                      type="text"
                      maxLength={CHECKOUT_LIMITS.observations}
                      placeholder={delivery === 'PICKUP' ? 'Ex.: levanto depois das 15h' : 'Ex.: ligar antes de entregar'}
                      value={form.observations}
                      onChange={(event) => set('observations', event.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </fieldset>

            {/* 3 · Oferta (se as definições da loja a permitirem) */}
            {giftAvailable && (
            <fieldset className="s7-passo">
              <legend>
                <b>3</b> Oferta
              </legend>
              <label className="s7-interruptor" htmlFor="s7-oferta">
                <input id="s7-oferta" name="oferta" type="checkbox" checked={form.gift} onChange={(event) => set('gift', event.target.checked)} />
                <span>
                  <strong>Esta encomenda é para oferecer</strong>
                  <small>Juntamos um cartão Boas Festas com a sua mensagem.</small>
                </span>
              </label>
              {form.gift && (
                <div className="s7-passo__sub">
                  <div className="s7-campos">
                    <Field name="recipient" label="Para quem é" error={errors.recipient} wide>
                      <input
                        {...inputProps('recipient')}
                        type="text"
                        placeholder="Nome da pessoa, equipa ou empresa"
                        maxLength={CHECKOUT_LIMITS.recipient}
                        required
                        value={form.recipient}
                        onChange={(event) => set('recipient', event.target.value)}
                      />
                    </Field>
                    <Field
                      name="giftMessage"
                      label={
                        <>
                          Mensagem do cartão <small>(opcional)</small>
                        </>
                      }
                      error={errors.giftMessage}
                      help={`${messageLeft} ${messageLeft === 1 ? 'carácter disponível' : 'caracteres disponíveis'}`}
                      wide
                    >
                      <textarea
                        {...inputProps('giftMessage', true)}
                        maxLength={options.giftMessageMaxLength}
                        value={form.giftMessage}
                        onChange={(event) => set('giftMessage', event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </fieldset>
            )}

            {/* Pagamento: Multicaixa Express ou transferência bancária (sem dados de cartão) */}
            <fieldset className="s7-passo">
              <legend>
                <b>{giftAvailable ? 4 : 3}</b> Pagamento
              </legend>
              {methods.length === 0 && (
                <p className="s7-passo__info" role="alert">
                  <Icon name="alerta" />
                  <span>Os pagamentos estão indisponíveis de momento. Tente novamente mais tarde.</span>
                </p>
              )}
              <div className="s7-opcoes">
                {methods.map((method) => (
                  <OptionCard
                    key={method}
                    name="pagamento"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => set('paymentMethod', method)}
                    icon={PAYMENT_OPTIONS[method].icon}
                    title={PAYMENT_METHOD_LABELS[method]}
                    note={PAYMENT_OPTIONS[method].note.replace('{prazo}', expressWindow)}
                  />
                ))}
              </div>
              {paymentMethod === 'MULTICAIXA_EXPRESS' && (
                <div className="s7-passo__sub">
                  <div className="s7-campos">
                    <Field
                      name="paymentPhone"
                      label="Telemóvel associado ao Multicaixa Express"
                      error={errors.paymentPhone}
                      help="Recebe neste número o pedido de pagamento para confirmar na aplicação."
                    >
                      <input
                        {...inputProps('paymentPhone', true)}
                        type="tel"
                        inputMode="tel"
                        placeholder="9XX XXX XXX"
                        required
                        value={form.paymentPhone}
                        onChange={(event) => set('paymentPhone', event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}
              {paymentMethod === 'MULTICAIXA_EXPRESS' && (
                <p className="s7-passo__info s7-passo__info--depois">
                  <Icon name="relogio" />
                  <span>
                    Depois de confirmar a encomenda, tem <strong>{expressWindow}</strong> para aceitar o pagamento na
                    aplicação Multicaixa Express.
                  </span>
                </p>
              )}
              {paymentMethod === 'IBAN' && (
                <div className="s7-passo__sub">
                  {options.bankTransfer ? (
                    <div className="s7-transferencia-dados">
                      <p className="s7-transferencia-dados__titulo">Dados para a transferência</p>
                      <p className="s7-transferencia-dados__ajuda">
                        Transfira o montante exacto a partir do seu banco. Use os botões <strong>Copiar</strong> para
                        colar os dados na aplicação.
                      </p>
                      <BankTransferList bank={options.bankTransfer} amount={total} />
                    </div>
                  ) : (
                    <p className="s7-passo__info">
                      <Icon name="recibo" />
                      <span>Enviamos os dados para a transferência no e-mail de confirmação da encomenda.</span>
                    </p>
                  )}
                  <div className="s7-campos">
                    <Field
                      name="paymentProof"
                      label={
                        <>
                          Comprovativo da transferência <small>(opcional)</small>
                        </>
                      }
                      error={errors.paymentProof}
                      help={PROOF_HELP}
                      wide
                    >
                      <ProofFileInput
                        id={fieldId('paymentProof')}
                        file={form.paymentProof}
                        invalid={Boolean(errors.paymentProof)}
                        describedBy={describedBy('paymentProof', true)}
                        onChange={chooseProof}
                      />
                    </Field>
                  </div>
                </div>
              )}
              {paymentMethod === 'IBAN' && (
                <p className="s7-passo__info s7-passo__info--depois">
                  <Icon name="recibo" />
                  <span>
                    Ainda não transferiu? Confirme a encomenda e envie o comprovativo depois, na página da encomenda.
                    A loja confirma o pagamento depois de verificar a transferência.
                  </span>
                </p>
              )}
            </fieldset>
          </div>

          <aside className="s7-resumo" aria-labelledby="s7-resumo-titulo">
            <h2 id="s7-resumo-titulo">A sua encomenda</h2>
            <ul className="s7-resumo__itens">
              {detail.lines.map((line) => (
                <li key={line.product.id}>
                  <div className="s7-linha__media">
                    <ProductImage product={line.product} size={104} width={52} height={52} alt="" />
                  </div>
                  <p>
                    <strong>{line.product.name}</strong>
                    <span>
                      {line.qty} × {formatKz(line.product.price)}
                    </span>
                  </p>
                  <b>{formatKz(line.subtotal)}</b>
                </li>
              ))}
            </ul>
            <dl className="s7-resumo__linhas">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatKz(detail.subtotal)}</dd>
              </div>
              {detail.savings > 0 && (
                <div className="s7-resumo__poupanca">
                  <dt>Poupa no escoamento</dt>
                  <dd>−{formatKz(detail.savings)}</dd>
                </div>
              )}
              <div>
                <dt>Entrega</dt>
                <dd>{deliveryFee > 0 ? formatKz(deliveryFee) : 'Sem custo'}</dd>
              </div>
            </dl>
            <p className="s7-resumo__total">
              <span>Total</span>
              <strong>{formatKz(total)}</strong>
            </p>
            <button
              className="s7-btn s7-btn--primario s7-btn--grande s7-btn--bloco"
              type="submit"
              disabled={mutation.isPending || sendingProof || !paymentMethod}
            >
              {sendingProof
                ? 'A enviar o comprovativo…'
                : mutation.isPending
                  ? 'A registar a encomenda…'
                  : 'Confirmar encomenda'}
            </button>
            {submitErrors.length > 0 && (
              <div className="s7-alerta" role="alert">
                {submitErrors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
            <p className="s7-resumo__nota">
              <Icon name="escudo" />
              <span>Não pedimos dados de cartão. O pagamento é feito por Multicaixa Express ou por transferência bancária.</span>
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}

