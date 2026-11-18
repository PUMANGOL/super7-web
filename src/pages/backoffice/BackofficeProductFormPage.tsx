import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import {
  parseAmount,
  readStoreAttributes,
  serializeStoreAttributes,
  toStoreFields,
  type StoreAttributes,
} from '../../catalog/attributes';
import { CABAZ_LEVELS, type CabazLevel } from '../../catalog/types';
import { ImageField } from '../../components/backoffice/ImageField';
import { Select } from '../../components/ui/Select';
import { CABAZ_CATEGORY_SLUGS, CAMPAIGNS, type CampaignId } from '../../config/store';
import { useToast } from '../../context/toast';
import { useCategories } from '../../hooks/useCategories';
import { useProduct, useSaveProduct } from '../../hooks/useProducts';
import type { ApiProduct, ProductKind, ProductRequest } from '../../types/api';
import { formatPrice } from '../../utils/helpers';
import './BackofficeAddBookPage.css';
import './BackofficeProductFormPage.css';

const KIND_OPTIONS: { value: ProductKind; label: string }[] = [
  { value: 'PHYSICAL', label: 'Físico (com stock)' },
  { value: 'DIGITAL', label: 'Digital' },
  { value: 'SERVICE', label: 'Serviço' },
];

const LEVEL_LABELS: Record<CabazLevel, string> = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze' };

interface Row {
  key: number;
  name: string;
  value: string;
}

interface FormState {
  name: string;
  sku: string;
  categoryId: string;
  kind: ProductKind;
  price: string;
  stock: string;
  available: boolean;
  description: string;
  format: string;
  summary: string;
  campaigns: CampaignId[];
  previousPrice: string;
  initialStock: string;
  featured: boolean;
  level: CabazLevel | '';
  badge: string;
  /** Artigos do cabaz: `name` = artigo, `value` = quantidade. */
  items: Row[];
  extra: Row[];
}

type Errors = Partial<Record<keyof FormState | 'image', string>>;

let rowSequence = 0;
const nextKey = () => {
  rowSequence += 1;
  return rowSequence;
};

function toFormState(product: ApiProduct | null): FormState {
  const attributes = readStoreAttributes(product);
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? '',
    kind: product?.kind ?? 'PHYSICAL',
    price: product ? String(product.price) : '',
    stock: product ? String(product.stock ?? 0) : '',
    available: product?.available ?? true,
    description: product?.description ?? '',
    format: attributes.format,
    summary: attributes.summary,
    campaigns: attributes.campaigns,
    previousPrice: attributes.previousPrice !== null ? String(attributes.previousPrice) : '',
    initialStock: attributes.initialStock !== null ? String(attributes.initialStock) : '',
    featured: attributes.featured,
    level: attributes.level ?? '',
    badge: attributes.badge,
    items: attributes.items.map((item) => ({ key: nextKey(), name: item.name, value: String(item.qty) })),
    extra: attributes.extra.map((attribute) => ({ key: nextKey(), name: attribute.name, value: attribute.value })),
  };
}

const isInteger = (value: string) => /^\d+$/.test(value.trim());

function validate(form: FormState, needsImage: boolean): Errors {
  const errors: Errors = {};
  const price = Number(form.price);

  if (!form.name.trim()) errors.name = 'Obrigatório';
  if (!form.sku.trim()) errors.sku = 'Obrigatório';
  else if (form.sku.trim().length > 80) errors.sku = 'Até 80 caracteres';
  if (!form.categoryId) errors.categoryId = 'Escolha a categoria';
  if (!form.price.trim() || !Number.isFinite(price) || price <= 0) errors.price = 'Indique um preço maior que zero';
  if (!isInteger(form.stock)) errors.stock = 'Indique um número inteiro (0 ou mais)';
  if (form.description.length > 2000) errors.description = 'Até 2000 caracteres';
  if (form.summary.length > 255) errors.summary = 'Até 255 caracteres';
  if (form.format.length > 255) errors.format = 'Até 255 caracteres';
  if (form.badge.length > 255) errors.badge = 'Até 255 caracteres';
  if (needsImage) errors.image = 'Escolha a imagem do produto';

  if (form.previousPrice.trim()) {
    const previous = parseAmount(form.previousPrice);
    if (previous === null) errors.previousPrice = 'Valor inválido';
    else if (Number.isFinite(price) && previous <= price) errors.previousPrice = 'Tem de ser maior que o preço actual';
  }
  if (form.initialStock.trim() && !isInteger(form.initialStock)) errors.initialStock = 'Indique um número inteiro';

  if (form.items.some((row) => row.name.trim() && (!isInteger(row.value) || Number(row.value) < 1))) {
    errors.items = 'Cada artigo precisa de uma quantidade inteira, 1 ou mais';
  } else if (form.items.some((row) => `${row.value} × ${row.name}`.length > 255)) {
    errors.items = 'Cada artigo tem de ter até 240 caracteres';
  }

  if (form.extra.some((row) => (row.name.trim() && !row.value.trim()) || (!row.name.trim() && row.value.trim()))) {
    errors.extra = 'Preencha o nome e o valor de cada atributo, ou apague a linha';
  } else if (form.extra.some((row) => row.name.length > 80 || row.value.length > 255)) {
    errors.extra = 'Nome até 80 caracteres e valor até 255';
  }

  return errors;
}

function ProductForm({ product }: { product: ApiProduct | null }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { mutate: save, isPending } = useSaveProduct();
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const editing = product !== null;
  const category = categories.find((item) => item.id === form.categoryId);
  const cabazCategory = Boolean(category && CABAZ_CATEGORY_SLUGS.includes(category.slug));
  const isCabaz = cabazCategory || form.level !== '';
  const onClearance = form.campaigns.includes('escoamento');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleCampaign = (id: CampaignId, checked: boolean) => {
    setForm((current) => ({
      ...current,
      campaigns: checked ? [...current.campaigns, id] : current.campaigns.filter((campaign) => campaign !== id),
      // Ao entrar no escoamento, o stock actual serve de ponto de partida da barra "Restam N".
      initialStock: id === 'escoamento' && checked && !current.initialStock ? current.stock : current.initialStock,
    }));
  };

  const updateRow = (list: 'items' | 'extra', key: number, field: 'name' | 'value', value: string) => {
    setForm((current) => ({
      ...current,
      [list]: current[list].map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    }));
    if (errors[list]) setErrors((current) => ({ ...current, [list]: undefined }));
  };

  const addRow = (list: 'items' | 'extra') =>
    setForm((current) => ({ ...current, [list]: [...current[list], { key: nextKey(), name: '', value: list === 'items' ? '1' : '' }] }));

  const removeRow = (list: 'items' | 'extra', key: number) =>
    setForm((current) => ({ ...current, [list]: current[list].filter((row) => row.key !== key) }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form, !editing && !image);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      showToast('Corrija os campos assinalados.', 'error');
      return;
    }

    const storeAttributes: StoreAttributes = {
      campaigns: form.campaigns,
      previousPrice: onClearance && form.previousPrice.trim() ? parseAmount(form.previousPrice) : null,
      initialStock: onClearance && form.initialStock.trim() ? Number(form.initialStock) : null,
      format: form.format,
      level: form.level || null,
      badge: isCabaz ? form.badge : '',
      summary: form.summary,
      items: isCabaz
        ? form.items.filter((row) => row.name.trim()).map((row) => ({ name: row.name.trim(), qty: Number(row.value) }))
        : [],
      featured: form.featured,
      extra: form.extra.map((row) => ({ name: row.name.trim(), value: row.value.trim() })),
    };

    const dto: ProductRequest = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      kind: form.kind,
      price: Number(form.price),
      stock: Number(form.stock),
      categoryId: form.categoryId,
      description: form.description.trim() || undefined,
      currency: product?.currency || 'AOA',
      coverImage: product?.coverImage ?? undefined,
      available: form.available,
      // Campos próprios propostos para a API; os atributos garantem que nada se perde enquanto não existem.
      ...toStoreFields(storeAttributes),
      attributes: serializeStoreAttributes(storeAttributes),
    };

    save(
      { id: product?.id, dto, image },
      {
        onSuccess: (saved) => {
          showToast(editing ? `"${saved.name}" actualizado.` : `"${saved.name}" criado.`);
          navigate('/backoffice/produtos');
        },
        onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível guardar o produto.'), 'error'),
      },
    );
  };

  const field = (key: keyof FormState) => `product-${key}`;
  const inputClass = (key: keyof FormState) => `form-input ${errors[key] ? 'error' : ''}`;

  return (
    <form className="add-book-form product-form" onSubmit={submit} noValidate>
      {/* Dados base (API) */}
      <section className="product-form-section">
        <div className="add-book-section-header">
          <h2 className="add-book-section-title">Produto</h2>
          <p className="add-book-section-subtitle">Dados guardados na API e usados no checkout (preço e stock).</p>
        </div>
        <div className="add-book-form-grid">
          <div className="form-group form-group-full">
            <label className="form-label" htmlFor={field('name')}>Nome</label>
            <input id={field('name')} className={inputClass('name')} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex.: Cesta Ouro" />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('sku')}>SKU (código único)</label>
            <input id={field('sku')} className={inputClass('sku')} value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="Ex.: CAB-OURO-2026" />
            {errors.sku && <span className="form-error">{errors.sku}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('categoryId')}>Categoria</label>
            <Select
              id={field('categoryId')}
              error={Boolean(errors.categoryId)}
              value={form.categoryId}
              onChange={(value) => update('categoryId', value)}
              disabled={loadingCategories}
              placeholder={loadingCategories ? 'A carregar…' : 'Escolha a categoria'}
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
              clearable={false}
            />
            {errors.categoryId && <span className="form-error">{errors.categoryId}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('price')}>Preço (Kz)</label>
            <input id={field('price')} type="number" min="1" step="1" className={inputClass('price')} value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="Ex.: 42000" />
            {errors.price && <span className="form-error">{errors.price}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('stock')}>Stock (unidades)</label>
            <input id={field('stock')} type="number" min="0" step="1" className={inputClass('stock')} value={form.stock} onChange={(e) => update('stock', e.target.value)} placeholder="Ex.: 80" />
            {errors.stock && <span className="form-error">{errors.stock}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('kind')}>Tipo</label>
            <Select
              id={field('kind')}
              value={form.kind}
              onChange={(value) => update('kind', value as ProductKind)}
              options={KIND_OPTIONS}
              clearable={false}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('format')}>Formato ou embalagem</label>
            <input id={field('format')} className={inputClass('format')} value={form.format} onChange={(e) => update('format', e.target.value)} placeholder="Ex.: 500 g · 6 × 1,5 L · 14 produtos" />
            {errors.format && <span className="form-error">{errors.format}</span>}
          </div>
          <div className="form-group form-group-full">
            <label className="form-label" htmlFor={field('summary')}>Resumo <small>(frase curta no cartão e no topo da página)</small></label>
            <input id={field('summary')} className={inputClass('summary')} maxLength={255} value={form.summary} onChange={(e) => update('summary', e.target.value)} placeholder="Ex.: A cesta mais completa, para a mesa de Natal de uma família grande." />
            {errors.summary && <span className="form-error">{errors.summary}</span>}
          </div>
          <div className="form-group form-group-full">
            <label className="form-label" htmlFor={field('description')}>Descrição</label>
            <textarea id={field('description')} className={`form-textarea ${errors.description ? 'error' : ''}`} rows={4} maxLength={2000} value={form.description} onChange={(e) => update('description', e.target.value)} />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          <ImageField
            id="product-image"
            label="Imagem"
            file={image}
            currentUrl={product?.coverImage}
            error={errors.image}
            onChange={(file) => {
              setImage(file);
              setErrors((current) => ({ ...current, image: undefined }));
            }}
            onInvalidFile={() => showToast('Escolha um ficheiro de imagem.', 'error')}
          />

          <div className="form-group form-group-full">
            <label className="add-book-checkbox">
              <input type="checkbox" checked={form.available} onChange={(e) => update('available', e.target.checked)} />
              <span>
                Visível na loja
                <small className="product-form-hint">
                  Desmarque para ocultar o produto: deixa de aparecer na loja (catálogo, pesquisa e categorias) e não pode
                  ser encomendado. Continua na lista de produtos do back-office, assinalado como Oculto, para o voltar a
                  mostrar quando quiser.
                </small>
              </span>
            </label>
          </div>
        </div>
      </section>

      <div className="add-book-form-divider" />

      {/* Campanhas (atributos) */}
      <section className="product-form-section">
        <div className="add-book-section-header">
          <h2 className="add-book-section-title">Campanhas e destaques</h2>
          <p className="add-book-section-subtitle">Definem onde o produto aparece na página inicial e no catálogo.</p>
        </div>
        <div className="product-form-checks">
          {(Object.keys(CAMPAIGNS) as CampaignId[]).map((id) => (
            <label className="add-book-checkbox" key={id}>
              <input
                type="checkbox"
                checked={form.campaigns.includes(id) || (id === 'natal' && isCabaz)}
                disabled={id === 'natal' && isCabaz}
                onChange={(e) => toggleCampaign(id, e.target.checked)}
              />
              <span>
                {CAMPAIGNS[id].label}
                <small className="product-form-hint">
                  {id === 'natal'
                    ? isCabaz
                      ? 'As cestas entram sempre na campanha de Natal.'
                      : 'Aparece no filtro e na faixa da campanha de Natal.'
                    : 'Mostra o preço riscado, a percentagem de desconto e o stock restante.'}
                </small>
              </span>
            </label>
          ))}
          <label className="add-book-checkbox">
            <input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} />
            <span>
              Destaque na página inicial
              <small className="product-form-hint">Aparece na secção "Destaques da loja" (até 5 produtos).</small>
            </span>
          </label>
        </div>

        {onClearance && (
          <div className="add-book-form-grid product-form-sub">
            <div className="form-group">
              <label className="form-label" htmlFor={field('previousPrice')}>Preço antes do escoamento (Kz)</label>
              <input id={field('previousPrice')} type="number" min="1" step="1" className={inputClass('previousPrice')} value={form.previousPrice} onChange={(e) => update('previousPrice', e.target.value)} placeholder="Ex.: 3200" />
              {errors.previousPrice ? (
                <span className="form-error">{errors.previousPrice}</span>
              ) : (
                Number(form.previousPrice) > Number(form.price) &&
                Number(form.price) > 0 && (
                  <span className="product-form-hint">
                    Desconto mostrado: −{Math.round((1 - Number(form.price) / Number(form.previousPrice)) * 100)}% (de{' '}
                    {formatPrice(Number(form.previousPrice))} para {formatPrice(Number(form.price))})
                  </span>
                )
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={field('initialStock')}>Stock no início do escoamento</label>
              <input id={field('initialStock')} type="number" min="0" step="1" className={inputClass('initialStock')} value={form.initialStock} onChange={(e) => update('initialStock', e.target.value)} />
              {errors.initialStock ? (
                <span className="form-error">{errors.initialStock}</span>
              ) : (
                <span className="product-form-hint">Base da barra "Restam N unidades".</span>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="add-book-form-divider" />

      {/* Cabaz */}
      <section className="product-form-section">
        <div className="add-book-section-header">
          <h2 className="add-book-section-title">Cesta de Natal</h2>
          <p className="add-book-section-subtitle">
            {cabazCategory
              ? 'Este produto está numa categoria de cestas.'
              : 'Preencha só se o produto for uma cesta. Escolher um nível já o marca como cesta.'}
          </p>
        </div>
        <div className="add-book-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor={field('level')}>Nível</label>
            <Select
              id={field('level')}
              value={form.level}
              onChange={(value) => update('level', value as CabazLevel | '')}
              placeholder="Sem nível"
              options={CABAZ_LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={field('badge')}>Selo <small>(opcional)</small></label>
            <input id={field('badge')} className={inputClass('badge')} disabled={!isCabaz} value={form.badge} onChange={(e) => update('badge', e.target.value)} placeholder="Ex.: A mais completa" />
          </div>
        </div>

        {isCabaz && (
          <div className="product-form-rows">
            <span className="form-label">O que inclui</span>
            {form.items.length > 0 && (
              <ul>
                {form.items.map((row, index) => (
                  <li key={row.key} className="product-form-row product-form-row--item">
                    <input
                      className="form-input"
                      aria-label={`Quantidade do artigo ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.value}
                      onChange={(e) => updateRow('items', row.key, 'value', e.target.value)}
                    />
                    <input
                      className="form-input"
                      aria-label={`Artigo ${index + 1}`}
                      value={row.name}
                      placeholder="Ex.: Arroz branco 1 kg"
                      onChange={(e) => updateRow('items', row.key, 'name', e.target.value)}
                    />
                    <button type="button" className="add-book-grade-remove" onClick={() => removeRow('items', row.key)} aria-label={`Remover artigo ${index + 1}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.items && <span className="form-error">{errors.items}</span>}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => addRow('items')}>
              <Plus size={16} /> Adicionar artigo
            </button>
          </div>
        )}
      </section>

      <div className="add-book-form-divider" />

      {/* Outros atributos */}
      <section className="product-form-section">
        <div className="add-book-section-header">
          <h2 className="add-book-section-title">Outros atributos</h2>
          <p className="add-book-section-subtitle">Pares livres (por exemplo cor, tamanho, marca). Ficam guardados no produto.</p>
        </div>
        <div className="product-form-rows">
          {form.extra.length > 0 && (
            <ul>
              {form.extra.map((row, index) => (
                <li key={row.key} className="product-form-row">
                  <input className="form-input" aria-label={`Nome do atributo ${index + 1}`} value={row.name} placeholder="Nome" onChange={(e) => updateRow('extra', row.key, 'name', e.target.value)} />
                  <input className="form-input" aria-label={`Valor do atributo ${index + 1}`} value={row.value} placeholder="Valor" onChange={(e) => updateRow('extra', row.key, 'value', e.target.value)} />
                  <button type="button" className="add-book-grade-remove" onClick={() => removeRow('extra', row.key)} aria-label={`Remover atributo ${index + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.extra && <span className="form-error">{errors.extra}</span>}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => addRow('extra')}>
            <Plus size={16} /> Adicionar atributo
          </button>
        </div>
      </section>

      <div className="add-book-form-actions">
        <Link to="/backoffice/produtos" className="btn btn-outline">
          Cancelar
        </Link>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'A guardar…' : editing ? 'Guardar alterações' : 'Criar produto'}
        </button>
      </div>
    </form>
  );
}

export function BackofficeProductFormPage() {
  const { id } = useParams();
  const { data: product, isLoading, isError } = useProduct(id);
  const editing = Boolean(id);

  return (
    <div className="backoffice-page backoffice-add-book-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">{editing ? 'Editar produto' : 'Novo produto'}</h1>
              <p className="section-subtitle">
                {editing && product ? product.name : 'Mercearia, bebidas, cestas, auto… tudo o que a loja vende.'}
              </p>
            </div>
            <Link to="/backoffice/produtos" className="btn btn-outline backoffice-add-book-back">
              <ArrowLeft size={16} />
              Voltar aos produtos
            </Link>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        <div className="backoffice-add-book-card">
          {editing && isLoading ? (
            <div className="backoffice-empty">
              <p>A carregar o produto…</p>
            </div>
          ) : editing && (isError || !product) ? (
            <div className="backoffice-empty">
              <p>Não encontrámos este produto.</p>
            </div>
          ) : (
            <ProductForm key={product?.id ?? 'novo'} product={editing ? product ?? null : null} />
          )}
        </div>
      </div>
    </div>
  );
}
