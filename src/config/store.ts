/**
 * Configuração da loja Super7 Digital.
 *
 * A API ainda não tem o conceito de campanha. As datas e os textos das campanhas
 * vivem aqui; a ligação entre um produto e uma campanha faz-se com atributos do
 * produto (ver `PRODUCT_ATTRIBUTES` e `src/catalog/attributes.ts`).
 */

export type CampaignId = 'natal' | 'escoamento';

export interface Campaign {
  id: CampaignId;
  /** Nome da campanha, por exemplo na faixa do topo. */
  name: string;
  /** Texto curto para menus e filtros. */
  label: string;
  /** Frase que aparece no cabeçalho temático do catálogo. */
  tagline: string;
  /** Descrição da listagem da campanha no catálogo. */
  description: string;
  /** Primeiro dia da campanha (AAAA-MM-DD, inclusive). */
  startsOn: string;
  /** Último dia da campanha (AAAA-MM-DD, inclusive). */
  endsOn: string;
  /** Prazo das encomendas (ISO 8601 com fuso). Já não aparece no banner. */
  ordersUntil?: string;
  /** Vem de `GET /campaign`; `false` desliga a campanha mesmo dentro das datas. */
  active?: boolean;
}

export const CAMPAIGNS: Record<CampaignId, Campaign> = {
  natal: {
    id: 'natal',
    name: 'Campanha Boas Festas',
    label: 'Cestas de Natal',
    tagline: 'Cestas prontas a oferecer, com laço e cartão.',
    description: 'Cestas para oferecer a clientes, colaboradores e família.',
    startsOn: '2026-11-01',
    endsOn: '2026-12-31',
    ordersUntil: '2026-12-23T18:00:00+01:00',
  },
  escoamento: {
    id: 'escoamento',
    name: 'Campanha de escoamento',
    label: 'Escoamento',
    tagline: 'Descontos enquanto houver stock nas lojas.',
    description: 'Produtos seleccionados com desconto, enquanto houver stock.',
    startsOn: '2026-11-01',
    endsOn: '2026-12-31',
  },
};

export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS) as CampaignId[];

export function isCampaignId(value: string | null | undefined): value is CampaignId {
  return value === 'natal' || value === 'escoamento';
}

/** A campanha está activa entre `startsOn` e o fim do dia `endsOn` (hora de Luanda). */
export function isCampaignActive(campaign: Campaign, now: Date = new Date()): boolean {
  if (campaign.active === false) return false;
  const start = new Date(`${campaign.startsOn}T00:00:00+01:00`).getTime();
  const end = new Date(`${campaign.endsOn}T23:59:59+01:00`).getTime();
  const time = now.getTime();
  return time >= start && time <= end;
}

/**
 * Categorias cujos produtos são cabazes. Um produto também conta como cabaz
 * quando tem o atributo `nivel` (ouro, prata ou bronze).
 */
export const CABAZ_CATEGORY_SLUGS = [
  'cabazes',
  'cabazes-de-natal',
  'cabazes-natal',
  'cestas',
  'cestas-de-natal',
  'cestas-natal',
];

/**
 * Atributos do produto (`attributes` na API) que a loja interpreta.
 * O back-office grava estes nomes; a leitura aceita também variantes com
 * maiúsculas, acentos, espaços ou hífenes (por exemplo "Preço anterior").
 */
export const PRODUCT_ATTRIBUTES = {
  /** natal, escoamento — separados por vírgula */
  campaigns: 'campanha',
  /** Preço antes do desconto, em kwanzas. Só conta se for maior que o preço actual. */
  previousPrice: 'preco_anterior',
  /** Stock no início do escoamento, para a barra "Restam N unidades". */
  initialStock: 'stock_inicial',
  /** Embalagem ou quantidade: "500 g", "6 × 1,5 L", "14 produtos". */
  format: 'formato',
  /** Nível do cabaz: ouro, prata ou bronze. */
  level: 'nivel',
  /** Etiqueta de destaque no cartão da cesta: "A mais completa". */
  badge: 'selo',
  /** Frase curta para o cartão e o topo da página do produto (até 255 caracteres). */
  summary: 'resumo',
  /** Um atributo por artigo do cabaz: "2 × Arroz branco 1 kg". */
  item: 'item',
  /** "sim" para aparecer nos destaques da página inicial. */
  featured: 'destaque',
  /** "sim" para mostrar o selo "Stock limitado" nos cartões e na página do produto. */
  limitedStock: 'stock_limitado',
} as const;

export const STORE = {
  name: 'Super7 Digital',
  /** Quantidade máxima por linha do carrinho. */
  maxQuantity: 99,
  /** Produtos por página no catálogo. */
  pageSize: 12,
} as const;

/* ---------------------------------------------------------------------------
   Funcionalidades da API ainda por implementar no backend
   (ver docs/api-campos-em-falta.md)
   ---------------------------------------------------------------------------
   Os campos novos nos pedidos e nas respostas são usados sempre que existem: a
   API actual ignora campos desconhecidos e o frontend lê-os quando aparecerem.
   Os endpoints novos só são chamados quando estiverem activos na variável de
   ambiente `api_features` (lista separada por vírgulas), para não gerar erros
   404 enquanto não existirem:

     campaigns          GET /campaign                datas e textos das campanhas
     checkout-options   GET /checkout/options        taxa e zonas de entrega, métodos de pagamento
     order-tracking     GET /order/{id}/tracking     estado da encomenda para o cliente, sem sessão
     order-fields       POST /order com os campos novos gravados: deixa de copiar
                        entrega, pagamento, NIF e oferta para as observações (`notes`)
     backoffice-theme   GET/PUT /settings/theme      cores do back-office para toda a equipa; sem
                        ela, as cores que o ADMIN escolhe ficam só no browser dele
     role-permissions   `permissions` em /role       permissões de cada perfil editáveis em "Perfis e
                        permissões" e perfis novos; sem ela, a tabela mostra as regras fixas da API
*/
export type ApiFeature =
  | 'campaigns'
  | 'checkout-options'
  | 'order-tracking'
  | 'order-fields'
  | 'backoffice-theme'
  | 'role-permissions';

const ENABLED_FEATURES = new Set(
  String(import.meta.env.api_features ?? '')
    .split(',')
    .map((feature) => feature.trim())
    .filter(Boolean),
);

export function hasApiFeature(feature: ApiFeature): boolean {
  return ENABLED_FEATURES.has(feature);
}

export type DeliveryType = 'PICKUP' | 'HOME_DELIVERY';
/**
 * A loja aceita Multicaixa Express e transferência bancária (IBAN), conforme as definições do back-office.
 * `REFERENCE` e `IN_STORE` só existem em encomendas antigas.
 */
export type PaymentMethod = 'MULTICAIXA_EXPRESS' | 'IBAN' | 'REFERENCE' | 'IN_STORE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

/** Métodos que a loja pode oferecer hoje (definições do back-office). */
export const STORE_PAYMENT_METHODS: PaymentMethod[] = ['MULTICAIXA_EXPRESS', 'IBAN'];

/**
 * Minutos que a loja dá ao cliente para aceitar cada pedido Multicaixa Express: a contagem e os textos usam-nos, a
 * contar do envio do pedido, mesmo que a API (app.payment.express-validity-minutes, em `GET /checkout/options`) dê
 * mais tempo. Também é o prazo da API quando ela não o indica.
 */
export const EXPRESS_VALIDITY_MINUTES = 2;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  IBAN: 'Transferência bancária (IBAN)',
  REFERENCE: 'Pagamento por referência',
  IN_STORE: 'Pagar na loja',
};

/** Onde o cliente levanta a encomenda: escolhe a loja, ou a loja fixa definida no back-office. */
export type PickupMode = 'CUSTOMER_CHOICE' | 'FIXED';

/** Dados para a transferência bancária, definidos no back-office. */
export interface BankTransferDetails {
  iban: string;
  holder: string;
  bank: string;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'por pagar',
  PAID: 'pago',
  FAILED: 'falhou',
  EXPIRED: 'expirou',
};

export interface CheckoutOptions {
  homeDelivery: {
    enabled: boolean;
    /** Taxa de entrega ao domicílio, em kwanzas. */
    fee: number;
    /** Zonas servidas, só para informação do cliente. */
    zones: string[];
  };
  /** Métodos de pagamento oferecidos, por esta ordem (Multicaixa Express e/ou IBAN). */
  paymentMethods: PaymentMethod[];
  /** Cartão de oferta (destinatário e mensagem) no checkout. */
  giftEnabled: boolean;
  giftMessageMaxLength: number;
  /** `FIXED`: o cliente não escolhe a loja; a encomenda vai para `fixedPostId`. */
  pickup: { mode: PickupMode; fixedPostId: string | null };
  /** Dados da transferência; null se o IBAN não estiver activo. */
  bankTransfer: BankTransferDetails | null;
  /** Tema de Natal (adereços natalícios). `null`: a API não diz; vale `CHRISTMAS_THEME_DEFAULT`. */
  christmasTheme: boolean | null;
  /** Minutos para aceitar cada pedido Multicaixa Express no telemóvel. */
  expressValidityMinutes: number;
  /** O cliente confirma o levantamento na página da encomenda ("Levantei!"); só com a API que o suporta. */
  receiptConfirmation: boolean;
  /** A API guarda o número Via na encomenda; sem isso, o número segue nas observações. */
  viaCardStored: boolean;
}

/**
 * Opções do checkout enquanto `GET /checkout/options` não existir (valores do layout).
 * Para retirar um método de pagamento ou a entrega ao domicílio antes de o backend
 * os suportar, altere aqui.
 */
export const DEFAULT_CHECKOUT_OPTIONS: CheckoutOptions = {
  homeDelivery: { enabled: true, fee: 2500, zones: ['Luanda'] },
  paymentMethods: ['MULTICAIXA_EXPRESS'],
  giftEnabled: true,
  giftMessageMaxLength: 240,
  pickup: { mode: 'CUSTOMER_CHOICE', fixedPostId: null },
  bankTransfer: null,
  christmasTheme: null,
  expressValidityMinutes: EXPRESS_VALIDITY_MINUTES,
  receiptConfirmation: false,
  viaCardStored: false,
};

/**
 * Tema de Natal quando a API não o indica (sem `checkout-options` ou com uma API anterior à opção):
 * ligado durante a campanha de Natal. Com a API nova, liga-se e desliga-se no back-office (Definições da loja).
 */
export const CHRISTMAS_THEME_DEFAULT = true;

/** Limites dos campos do checkout. `notes` é o limite da API para as observações. */
export const CHECKOUT_LIMITS = {
  notes: 500,
  nif: 20,
  via: 30,
  recipient: 60,
  observations: 160,
  address: 160,
  district: 80,
  addressReference: 120,
} as const;

/** Ícones do sprite que podem ser atribuídos a uma categoria no back-office. */
export const CATEGORY_ICONS = [
  { value: 'box', label: 'Caixa (genérico)' },
  { value: 'gift', label: 'Presente (cestas, ofertas)' },
  { value: 'basket', label: 'Cesto (mercearia)' },
  { value: 'bottle', label: 'Garrafa (bebidas)' },
  { value: 'cookie', label: 'Bolacha (snacks e doces)' },
  { value: 'sparkles', label: 'Brilho (higiene e casa)' },
  { value: 'drop', label: 'Gota (auto e lubrificantes)' },
  { value: 'book', label: 'Livro (livros)' },
  { value: 'tag', label: 'Etiqueta (promoções)' },
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number]['value'];
