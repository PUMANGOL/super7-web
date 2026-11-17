/**
 * Tipos do contrato da Pumangol Marketplace API (ver docs/openapi.yaml no repositório da API).
 *
 * Os campos marcados com "Proposto" ainda não existem na API: estão descritos em
 * docs/api-campos-em-falta.md. São todos opcionais, para o frontend funcionar com
 * a API actual (que os ignora nos pedidos e não os devolve) e com a futura.
 */
import type { BankTransferDetails, DeliveryType, PaymentMethod, PaymentStatus, PickupMode } from '../config/store';

export type UUID = string;

export interface ApiResponse<T> {
  status: string;
  data: T;
  errors: string[] | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/* ---------- Catálogo ---------- */

export type ProductKind = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

export interface ProductAttribute {
  name: string;
  value: string;
}

/** Proposto: nível do cabaz de Natal. */
export type HamperLevel = 'GOLD' | 'SILVER' | 'BRONZE';

/** Proposto: artigo incluído num cabaz. */
export interface HamperItem {
  name: string;
  quantity: number;
}

/** Proposto: campos de loja do produto (hoje guardados em `attributes`). */
export interface ProductStoreFields {
  /** Slugs das campanhas: ["natal"], ["escoamento"]. */
  campaigns?: string[] | null;
  /** Preço antes do desconto (maior que `price`). */
  previousPrice?: number | null;
  /** Stock no início do escoamento. */
  initialStock?: number | null;
  /** "500 g", "6 × 1,5 L". */
  format?: string | null;
  /** Frase curta, até 255 caracteres. */
  summary?: string | null;
  hamperLevel?: HamperLevel | null;
  /** Etiqueta do cartão da cesta: "A mais completa". */
  badge?: string | null;
  hamperItems?: HamperItem[] | null;
  /** Destaque na página inicial. */
  featured?: boolean | null;
}

export interface ApiProduct extends ProductStoreFields {
  id: UUID;
  name: string;
  sku: string;
  description: string | null;
  kind: ProductKind;
  price: number;
  currency: string;
  stock: number | null;
  available: boolean;
  categoryId: UUID | null;
  category: string | null;
  /** A categoria do produto pede para mostrar a quantidade em stock na loja. */
  showStock?: boolean;
  coverImage: string | null;
  status: string;
  sellerId: UUID | null;
  attributes: ProductAttribute[] | null;
}

/** Corpo de POST /product (parte `dto`) e PUT /product/{id}. */
export interface ProductRequest extends ProductStoreFields {
  name: string;
  sku: string;
  kind: ProductKind;
  price: number;
  stock: number;
  categoryId: UUID;
  description?: string;
  currency?: string;
  coverImage?: string;
  available?: boolean;
  attributes?: ProductAttribute[];
}

/** Proposto: `GET /campaign` (público) devolve as campanhas activas. */
export interface ApiCampaign {
  id: UUID;
  /** "natal", "escoamento": é o valor usado em `Product.campaigns`. */
  slug: string;
  name: string;
  description: string | null;
  /** AAAA-MM-DD */
  startDate: string;
  /** AAAA-MM-DD */
  endDate: string;
  /** Prazo das encomendas (ISO 8601 com fuso), para a contagem decrescente. */
  ordersUntil: string | null;
  active: boolean;
}

/** Proposto: `GET /checkout/options` (público). */
export interface ApiCheckoutOptions {
  homeDeliveryEnabled: boolean;
  homeDeliveryFee: number;
  homeDeliveryZones: string[];
  paymentMethods: PaymentMethod[];
  giftMessageMaxLength: number;
  /** Cartão de oferta permitido no checkout. */
  giftEnabled?: boolean;
  /** `CUSTOMER_CHOICE` (o cliente escolhe a loja) ou `FIXED` (`fixedPickupPostId`). */
  pickupMode?: PickupMode;
  fixedPickupPostId?: UUID | null;
  /** Dados da transferência bancária; null quando o IBAN não está activo. */
  bankTransfer?: BankTransferDetails | null;
}

/** Definições da loja (back-office): `GET /settings` e `PUT /settings`. */
export interface StoreSettings {
  /** Métodos activos: `MULTICAIXA_EXPRESS` e/ou `IBAN`. */
  paymentMethods: PaymentMethod[];
  pickupMode: PickupMode;
  /** Obrigatório com `pickupMode: FIXED`. */
  fixedPickupPostId: UUID | null;
  homeDeliveryEnabled: boolean;
  giftEnabled: boolean;
  /** Dados mostrados ao cliente no pagamento por IBAN. */
  iban: string | null;
  ibanHolder: string | null;
  ibanBank: string | null;
  /** Só na resposta: quando e por quem (e-mail) foram alteradas pela última vez. */
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface Category {
  id: UUID;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  /** Mostrar a quantidade em stock dos produtos desta categoria na loja. */
  showStock?: boolean;
}

export interface CategoryRequest {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  showStock?: boolean;
}

export interface Level {
  id: UUID;
  name: string;
  slug: string;
  sortOrder?: number | null;
}

export interface SchoolClass {
  id: UUID;
  name: string;
  slug: string | null;
  educationLevelId: UUID;
  sortOrder?: number | null;
}

export interface ApiBook {
  id: UUID;
  title: string;
  categoryId: UUID;
  category: string;
  grades: SchoolClass[] | null;
  quantity: number | null;
  price: number;
  coverImage: string | null;
  author: string;
  isbn: string;
  available: boolean;
  description: string | null;
}

export interface CreateBookDto {
  title: string;
  categoryId: UUID;
  grades: UUID[];
  price: number;
  author: string;
  isbn: string;
  available: boolean;
}

/** Proposto: dados de contacto da loja (hoje o posto de recolha só tem nome). */
export interface PickupPostDetails {
  /** Município ou bairro: "Talatona, Luanda". */
  zone?: string | null;
  address?: string | null;
  /** "Todos os dias, 06h00–22h00". */
  openingHours?: string | null;
  phone?: string | null;
}

export interface PickupPost extends PickupPostDetails {
  id: UUID;
  name: string;
}

export interface PickupPostRequest extends PickupPostDetails {
  name: string;
}

/* ---------- Encomendas ---------- */

export interface OrderCustomer {
  fullName: string;
  phone: string;
  email: string;
  location: string;
  /** Proposto: NIF para a factura. */
  nif?: string | null;
}

/** Proposto: morada da entrega ao domicílio. */
export interface DeliveryAddress {
  address: string;
  /** Bairro ou município. */
  district: string;
  /** Ponto de referência. */
  reference?: string | null;
}

/** Proposto: oferta com cartão Boas Festas. */
export interface OrderGift {
  recipient: string;
  message?: string | null;
}

/** Proposto: pagamento da encomenda, gerido pela API. */
export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  /** Multicaixa Express: telemóvel que recebe o pedido de pagamento. */
  phone?: string | null;
  /** Pagamento por referência. */
  entity?: string | null;
  reference?: string | null;
  amount?: number | null;
  /** Fim da validade do pedido Multicaixa Express (2 minutos). O IBAN não expira sozinho. */
  expiresAt?: string | null;
  paidAt?: string | null;
  /** IBAN: comprovativo enviado pelo cliente (nome original, tipo e data). null enquanto não houver. */
  proofFileName?: string | null;
  proofContentType?: string | null;
  proofUploadedAt?: string | null;
  /**
   * Fim da reserva da encomenda: até lá, um pedido Express expirado ou recusado (FAILED/EXPIRED) não a cancela e o
   * cliente pode pedir outro pagamento (`POST /order/{id}/payment`). null sem novas tentativas.
   */
  holdUntil?: string | null;
  /** Pedidos de pagamento feitos (1 no checkout). */
  attempts?: number | null;
}

/** Nova tentativa de pagamento pedida pelo cliente: Multicaixa Express outra vez ou mudança para IBAN. */
export interface PaymentRetryRequest {
  method: 'MULTICAIXA_EXPRESS' | 'IBAN';
  /** Multicaixa Express: telemóvel com 9 dígitos, começado por 9. */
  phone?: string;
}

/** Envie `productId` (os livros também são produtos). */
export interface OrderItemRequest {
  productId?: UUID;
  bookId?: UUID;
  quantity: number;
}

export interface OrderRequest {
  customer: OrderCustomer;
  /** Loja de levantamento ou, na entrega ao domicílio, a loja que prepara a encomenda. */
  pickupPostId: UUID;
  notes?: string;
  items: OrderItemRequest[];
  /** Proposto. */
  deliveryType?: DeliveryType;
  /** Proposto: data prevista de levantamento (AAAA-MM-DD). */
  pickupDate?: string;
  /** Proposto: obrigatório quando `deliveryType` é HOME_DELIVERY. */
  deliveryAddress?: DeliveryAddress;
  /** Proposto. */
  gift?: OrderGift;
  /** Proposto. */
  paymentMethod?: PaymentMethod;
  /** Proposto: obrigatório com MULTICAIXA_EXPRESS. */
  paymentPhone?: string;
}

export interface ApiOrderItem {
  id: UUID;
  productId: UUID | null;
  bookId: UUID | null;
  /** Nome do produto ou livro. */
  book: string;
  coverImage?: string | null;
  quantity: number;
  price: number;
  subTotal: number;
}

export interface ApiOrder {
  id: UUID;
  /**
   * Referência da compra para o controlo dos pagamentos: 5 caracteres (letras e algarismos), gerada pela API.
   * É a `referencia` do pedido de pagamento Multicaixa Express. null nas encomendas antigas.
   */
  compraRef?: string | null;
  customer: OrderCustomer;
  pickupPostId: UUID;
  pickupPost: string;
  notes: string | null;
  items: ApiOrderItem[];
  status: string;
  createAt: string;
  /** Hoje é a soma dos itens. Com o campo `deliveryFee`, passa a incluir a taxa de entrega. */
  total: number;
  /** Proposto. */
  deliveryType?: DeliveryType | null;
  /** Proposto. */
  pickupDate?: string | null;
  /** Proposto. */
  deliveryAddress?: DeliveryAddress | null;
  /** Proposto. */
  gift?: OrderGift | null;
  /** Proposto: soma dos itens. */
  subtotal?: number | null;
  /** Proposto: taxa de entrega calculada pela API (0 no levantamento). */
  deliveryFee?: number | null;
  /** Proposto. */
  payment?: OrderPayment | null;
}

/* ---------- Autenticação ---------- */

export interface AuthRole {
  id: UUID;
  name: string;
}

export interface AuthUser {
  id: UUID;
  email: string;
  name: string;
  msisdn: string;
  status: string;
  alterPassword: boolean;
  avatar: string | null;
  roles: AuthRole[];
  typeUser: number;
  perfil: string;
  active: boolean;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignInResponse {
  token: string;
  user: AuthUser;
}
