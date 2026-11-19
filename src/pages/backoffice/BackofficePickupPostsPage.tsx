import { useState, type FormEvent } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { pickupPostDetails } from '../../api/pickupPosts';
import { formatCoordinates, mapUrl, parseCoordinates, postCoordinates } from '../../catalog/maps';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/toast';
import { useDeletePickupPost, usePickupPosts, useSavePickupPost } from '../../hooks/usePickupPosts';
import type { PickupPost, PickupPostRequest } from '../../types/api';
import './BackofficeAddBookPage.css';
import './BackofficeProductFormPage.css';

const DETAIL_FIELDS = ['zone', 'address', 'openingHours', 'phone'] as const;
type TextField = 'name' | (typeof DETAIL_FIELDS)[number];

const LOCATION_ERROR =
  'Não encontrámos coordenadas. Cole "latitude, longitude" (ex.: -8.901612, 13.203219) ou um link do Google Maps ' +
  'com coordenadas; os links curtos (maps.app.goo.gl) não as trazem.';

/** Localização inicial do formulário: a gravada ou, sem ela, as coordenadas escritas na morada. */
function initialLocation(post: PickupPost | null): { text: string; fromAddress: boolean } {
  const saved = postCoordinates(post);
  if (saved) return { text: formatCoordinates(saved), fromAddress: false };
  const inAddress = post?.address ? parseCoordinates(post.address) : null;
  return inAddress ? { text: formatCoordinates(inAddress), fromAddress: true } : { text: '', fromAddress: false };
}

/** A API devolve os campos de contacto da loja? (Hoje só devolve `id` e `name`.) */
function apiStoresDetails(posts: PickupPost[]): boolean {
  return posts.some((post) => DETAIL_FIELDS.some((field) => field in post));
}

function PostForm({ post, onClose }: { post: PickupPost | null; onClose: () => void }) {
  const { showToast } = useToast();
  const { mutate: savePost, isPending } = useSavePickupPost();
  const [form, setForm] = useState<PickupPostRequest>({
    name: post?.name ?? '',
    zone: post?.zone ?? '',
    address: post?.address ?? '',
    openingHours: post?.openingHours ?? '',
    phone: post?.phone ?? '',
  });
  const [nameError, setNameError] = useState(false);
  const [location, setLocation] = useState(() => initialLocation(post));
  const [locationError, setLocationError] = useState(false);
  const coordinates = parseCoordinates(location.text);
  const locationUrl = mapUrl(coordinates);

  const update = (key: TextField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'name') setNameError(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const badLocation = Boolean(location.text.trim()) && !coordinates;
    setNameError(!form.name.trim());
    setLocationError(badLocation);
    if (!form.name.trim()) {
      document.getElementById('post-name')?.focus();
      return;
    }
    if (badLocation) {
      document.getElementById('post-location')?.focus();
      return;
    }
    const dto: PickupPostRequest = {
      name: form.name.trim(),
      zone: form.zone?.trim() || null,
      address: form.address?.trim() || null,
      openingHours: form.openingHours?.trim() || null,
      phone: form.phone?.trim() || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    };
    const filledDetails = DETAIL_FIELDS.some((field) => dto[field]);

    savePost(
      { id: post?.id, dto },
      {
        onSuccess: (saved) => {
          const stored = DETAIL_FIELDS.some((field) => field in saved);
          const locationLost = Boolean(coordinates) && !('latitude' in saved);
          let message = post ? 'Loja actualizada.' : `Loja "${dto.name}" adicionada.`;
          if (filledDetails && !stored) message = 'Nome gravado. A API ainda não guarda zona, morada, horário e telefone.';
          else if (locationLost) message = 'Loja gravada, mas a API ainda não guarda a localização no mapa.';
          showToast(message, (filledDetails && !stored) || locationLost ? 'error' : 'success');
          onClose();
        },
        onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível guardar a loja.'), 'error'),
      },
    );
  };

  const field = (key: TextField, label: string, placeholder: string, full = false) => (
    <div className={full ? 'form-group form-group-full' : 'form-group'}>
      <label className="form-label" htmlFor={`post-${key}`}>
        {label}
      </label>
      <input
        id={`post-${key}`}
        className={`form-input ${key === 'name' && nameError ? 'error' : ''}`}
        value={form[key] ?? ''}
        placeholder={placeholder}
        onChange={(event) => update(key, event.target.value)}
      />
      {key === 'name' && nameError && <span className="form-error">Obrigatório</span>}
    </div>
  );

  return (
    <form className="add-book-form" onSubmit={submit} noValidate>
      <div className="add-book-form-grid">
        {field('name', 'Nome', 'Ex.: Super7 Talatona', true)}
        {field('zone', 'Zona (município ou bairro)', 'Ex.: Talatona, Luanda')}
        {field('phone', 'Telefone', 'Ex.: 923 000 000')}
        {field('address', 'Morada', 'Ex.: Via S8, posto Pumangol de Talatona', true)}
        {field('openingHours', 'Horário', 'Ex.: Todos os dias, 06h00–22h00', true)}
        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="post-location">
            Localização no mapa
          </label>
          <input
            id="post-location"
            className={`form-input ${locationError ? 'error' : ''}`}
            value={location.text}
            placeholder="Ex.: -8.901612, 13.203219"
            aria-invalid={locationError || undefined}
            aria-describedby="post-location-help"
            onChange={(event) => {
              setLocation({ text: event.target.value, fromAddress: false });
              setLocationError(false);
            }}
          />
          <p className="post-location-help" id="post-location-help">
            Cole as coordenadas (latitude, longitude) ou um link do Google Maps. No Google Maps, carregue com o botão
            direito no local e copie as coordenadas. Na loja online aparece um ícone, junto ao nome da loja, que abre o
            mapa neste ponto.
          </p>
          {location.fromAddress && (
            <p className="post-location-found">Encontrámos estas coordenadas na morada. Confirme no mapa e grave.</p>
          )}
          {locationError && <span className="form-error">{LOCATION_ERROR}</span>}
          {locationUrl && coordinates && (
            <a className="post-location-check" href={locationUrl} target="_blank" rel="noopener noreferrer">
              <MapPin size={14} aria-hidden="true" />
              Confirmar no mapa ({formatCoordinates(coordinates)})
            </a>
          )}
        </div>
      </div>
      <div className="add-book-form-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'A guardar…' : post ? 'Guardar alterações' : 'Adicionar loja'}
        </button>
      </div>
    </form>
  );
}

export function BackofficePickupPostsPage() {
  const { data: posts = [], isLoading, isError, refetch } = usePickupPosts();
  const { mutate: deletePost, isPending: deleting } = useDeletePickupPost();
  const { showToast } = useToast();
  const [modal, setModal] = useState<{ open: boolean; post: PickupPost | null }>({ open: false, post: null });
  const [toDelete, setToDelete] = useState<PickupPost | null>(null);
  const detailsSupported = apiStoresDetails(posts);

  const confirmDelete = () => {
    if (!toDelete) return;
    deletePost(toDelete.id, {
      onSuccess: () => {
        showToast(`Loja "${toDelete.name}" eliminada.`);
        setToDelete(null);
      },
      onError: (error) =>
        showToast(getApiErrorMessage(error, 'Não foi possível eliminar a loja. Pode ter encomendas associadas.'), 'error'),
    });
  };

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Lojas de levantamento</h1>
              <p className="section-subtitle">
                As lojas Super7 que o cliente escolhe no checkout, para levantar ou para preparar a entrega ao domicílio.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, post: null })}>
              <Plus size={18} />
              Adicionar loja
            </button>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {!isLoading && posts.length > 0 && !detailsSupported && (
          <p className="backoffice-note">
            A API ainda só guarda o nome da loja. A zona, a morada, o horário e o telefone já podem ser preenchidos aqui
            e aparecem na loja online assim que o backend os guardar.
          </p>
        )}

        {isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar lojas…</p>
          </div>
        ) : isError ? (
          <div className="backoffice-empty">
            <p>Não foi possível carregar as lojas.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="backoffice-empty">
            <p>Ainda não há lojas. Sem pelo menos uma, os clientes não conseguem finalizar a compra.</p>
          </div>
        ) : (
          <div className="backoffice-table-wrap">
            <table className="backoffice-table backoffice-table--categories">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Zona e horário</th>
                  <th>Telefone</th>
                  <th>Acções</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="backoffice-book-title">{post.name}</div>
                      {post.address && <div className="backoffice-book-meta">{post.address}</div>}
                    </td>
                    <td>{pickupPostDetails(post) || '—'}</td>
                    <td>{post.phone || '—'}</td>
                    <td>
                      <div className="backoffice-actions">
                        {postCoordinates(post) ? (
                          <a
                            className="backoffice-book-delete backoffice-visibility"
                            href={mapUrl(postCoordinates(post)) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ver ${post.name} no mapa`}
                            title="Ver no mapa"
                          >
                            <MapPin size={16} />
                          </a>
                        ) : (
                          <span className="backoffice-sem-mapa" title="Sem localização no mapa">
                            <MapPin size={16} aria-hidden="true" />
                            <span className="sr-only">Sem localização no mapa</span>
                          </span>
                        )}
                        <button
                          type="button"
                          className="backoffice-book-delete"
                          onClick={() => setModal({ open: true, post })}
                          aria-label={`Editar ${post.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="backoffice-book-delete"
                          onClick={() => setToDelete(post)}
                          aria-label={`Eliminar ${post.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, post: null })}
        title={modal.post ? 'Editar loja' : 'Nova loja'}
        maxWidth="620px"
      >
        <PostForm key={modal.post?.id ?? 'nova'} post={modal.post} onClose={() => setModal({ open: false, post: null })} />
      </Modal>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar loja"
        message={toDelete ? `Eliminar "${toDelete.name}"? A eliminação é definitiva.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleting}
      />
    </div>
  );
}
