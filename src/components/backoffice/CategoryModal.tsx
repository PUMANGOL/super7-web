import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { CATEGORY_ICONS } from '../../config/store';
import { useToast } from '../../context/toast';
import { useSaveCategory } from '../../hooks/useSaveCategory';
import type { Category } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import './CategoryModal.css';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Categoria a editar; sem ela, o modal cria uma nova. */
  category?: Category | null;
}

interface CategoryFormState {
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  showStock: boolean;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function initialState(category: Category | null | undefined): CategoryFormState {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    icon: category?.icon ?? '',
    color: category?.color || '#017649',
    description: category?.description ?? '',
    showStock: Boolean(category?.showStock),
  };
}

function CategoryForm({ category, onClose }: { category?: Category | null; onClose: () => void }) {
  const { showToast } = useToast();
  const { mutate: saveCategory, isPending } = useSaveCategory();
  const [form, setForm] = useState<CategoryFormState>(() => initialState(category));
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormState, string>>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(category));

  const update = <K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const slug = slugify(form.slug || form.name);
    const found: Partial<Record<keyof CategoryFormState, string>> = {};
    if (!form.name.trim()) found.name = 'Obrigatório';
    if (!slug) found.slug = 'Obrigatório (letras minúsculas, números e hífenes)';
    if (form.description.length > 255) found.description = 'Até 255 caracteres';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    saveCategory(
      {
        id: category?.id,
        dto: {
          name: form.name.trim(),
          slug,
          icon: form.icon || undefined,
          color: form.color.trim() || undefined,
          description: form.description.trim() || undefined,
          showStock: form.showStock,
        },
      },
      {
        onSuccess: () => {
          showToast(category ? 'Categoria actualizada.' : 'Categoria criada.');
          onClose();
        },
        onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível guardar a categoria.'), 'error'),
      },
    );
  };

  return (
    <form className="add-category-form" onSubmit={submit} noValidate>
      <div className="add-category-form-grid">
        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="category-name">Nome</label>
          <input
            id="category-name"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Ex.: Mercearia"
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="category-slug">Slug (endereço)</label>
          <input
            id="category-slug"
            className={`form-input ${errors.slug ? 'error' : ''}`}
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              update('slug', event.target.value);
            }}
            placeholder="Ex.: mercearia"
          />
          {errors.slug ? (
            <span className="form-error">{errors.slug}</span>
          ) : (
            <span className="form-label-hint">
              Usado no endereço do catálogo (/catalogo?categoria={slugify(form.slug || form.name) || '…'}). Para as cestas de
              Natal use <strong>cestas</strong>.
            </span>
          )}
        </div>

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="category-icon">Ícone na loja</label>
          <Select
            id="category-icon"
            value={form.icon}
            onChange={(value) => update('icon', value)}
            placeholder="Automático (pelo nome)"
            options={CATEGORY_ICONS.map((icon) => ({ value: icon.value, label: icon.label }))}
          />
        </div>

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="category-color">Cor</label>
          <div className="add-category-color-field">
            <input
              id="category-color"
              type="color"
              className="add-category-color-picker"
              value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#017649'}
              onChange={(event) => update('color', event.target.value)}
              aria-label="Seleccionar cor"
            />
            <input
              className="form-input"
              value={form.color}
              maxLength={20}
              onChange={(event) => update('color', event.target.value)}
              placeholder="#017649"
              aria-label="Código da cor"
            />
          </div>
        </div>

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="category-description">Descrição <small>(aparece no topo da listagem)</small></label>
          <textarea
            id="category-description"
            className={`form-textarea ${errors.description ? 'error' : ''}`}
            value={form.description}
            maxLength={255}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Ex.: Arroz, massas, óleo e os básicos da despensa."
            rows={3}
          />
          {errors.description && <span className="form-error">{errors.description}</span>}
        </div>

        <div className="form-group form-group-full">
          <label className="add-category-check" htmlFor="category-show-stock">
            <input
              id="category-show-stock"
              type="checkbox"
              checked={form.showStock}
              onChange={(event) => update('showStock', event.target.checked)}
            />
            <span>
              Mostrar a quantidade em stock na loja
              <small>Nos produtos desta categoria aparece, por exemplo, «12 em stock».</small>
            </span>
          </label>
        </div>
      </div>

      <div className="add-category-form-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'A guardar…' : category ? 'Guardar alterações' : 'Criar categoria'}
        </button>
      </div>
    </form>
  );
}

export function CategoryModal({ isOpen, onClose, category }: CategoryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Editar categoria' : 'Nova categoria'} maxWidth="560px">
      {/* A chave recria o formulário ao abrir para outra categoria. */}
      <CategoryForm key={category?.id ?? 'nova'} category={category} onClose={onClose} />
    </Modal>
  );
}
