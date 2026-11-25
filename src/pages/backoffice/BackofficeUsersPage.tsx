import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Eye, EyeOff, KeyRound, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import { getApiErrorMessage, getApiErrorMessages, getApiStatus } from '../../api/client';
import { USERS_PAGE_SIZE } from '../../api/users';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useDeleteUser, useRoles, useSaveUser, useUsers } from '../../hooks/useUsers';
import type { AuthRole, AuthUser } from '../../types/api';
import { isTeamRole, roleDescription, roleDisplayName } from '../../utils/auth';
import { firstName, formatPhone, initials, plural } from '../../utils/format';
import './BackofficeSettingsPage.css';
import './BackofficeUsersPage.css';

type Scope = 'equipa' | 'clientes' | 'todos';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'equipa', label: 'Equipa' },
  { id: 'clientes', label: 'Clientes da loja' },
  { id: 'todos', label: 'Todos' },
];

const ROWS_PER_PAGE = 20;
const MIN_PASSWORD = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isTeamUser = (user: AuthUser) => (user.roles ?? []).some(isTeamRole);
const isAdmin = (user: AuthUser) => (user.roles ?? []).some((role) => role.name === 'ADMIN');

/** Só algarismos; um número angolano de 9 algarismos (9XX XXX XXX) ganha o 244 à frente. */
function normalizeMsisdn(value: string): string {
  const digits = value.replace(/\D/g, '');
  return /^9\d{8}$/.test(digits) ? `244${digits}` : digits;
}

/** Password para entregar à pessoa: 12 caracteres sem os que se confundem (0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function roleTone(role: AuthRole): string {
  if (role.name === 'ADMIN') return 'bo-etiqueta--primario';
  if (!isTeamRole(role)) return 'bo-etiqueta--info';
  return 'bo-etiqueta--neutro';
}

function RoleBadges({ roles }: { roles: AuthRole[] }) {
  if (roles.length === 0) return <span className="utilizadores-sem-perfil">Sem perfil</span>;
  return (
    <span className="utilizadores-perfis">
      {roles.map((role) => (
        <span key={role.id} className={`bo-etiqueta ${roleTone(role)}`}>
          {roleDisplayName(role.name)}
        </span>
      ))}
    </span>
  );
}

interface UserFormProps {
  user: AuthUser | null;
  roles: AuthRole[];
  rolesError: boolean;
  isSelf: boolean;
  /** É o único administrador: não pode perder o perfil. */
  onlyAdmin: boolean;
  onClose: () => void;
}

function UserForm({ user, roles, rolesError, isSelf, onlyAdmin, onClose }: UserFormProps) {
  const { showToast } = useToast();
  const { mutate: saveUser, isPending } = useSaveUser();
  const editing = user !== null;
  const teamRoles = roles.filter(isTeamRole);
  // Perfis que não aparecem na lista (ex.: USER, o dos clientes) mantêm-se ao gravar.
  const keptRoleIds = (user?.roles ?? []).filter((role) => !isTeamRole(role)).map((role) => role.id);
  const wasTeam = user ? isTeamUser(user) : true;

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    msisdn: user?.msisdn ?? '',
    password: '',
  });
  const [selected, setSelected] = useState<string[]>(() =>
    (user?.roles ?? []).filter(isTeamRole).map((role) => role.id),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'msisdn' | 'password' | 'roles', string>>>({});
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleRole = (id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((roleId) => roleId !== id)));
    setErrors((current) => ({ ...current, roles: undefined }));
  };

  /** O próprio ADMIN e o único ADMIN não podem perder o perfil: ficariam sem ninguém para gerir a equipa. */
  const lockedReason = (role: AuthRole): string | null => {
    if (role.name !== 'ADMIN' || !user || !isAdmin(user)) return null;
    if (isSelf) return 'Não pode tirar o perfil de administrador à sua própria conta.';
    if (onlyAdmin) return 'É o único administrador. Dê o perfil a outra pessoa antes de o tirar a esta.';
    return null;
  };

  const validate = () => {
    const found: typeof errors = {};
    if (form.name.trim().length < 2) found.name = 'Indique o nome.';
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = 'Indique um e-mail válido.';
    const msisdn = normalizeMsisdn(form.msisdn);
    if (msisdn.length < 9 || msisdn.length > 15) found.msisdn = 'Indique o telefone (ex.: 923 000 000).';
    if (!editing && !form.password) found.password = 'Indique a password ou carregue em "Gerar".';
    else if (form.password && form.password.length < MIN_PASSWORD)
      found.password = `A password tem de ter pelo menos ${MIN_PASSWORD} caracteres.`;
    if (selected.length === 0 && wasTeam)
      found.roles = editing
        ? 'Escolha pelo menos um perfil. Para tirar o acesso a esta pessoa, elimine a conta.'
        : 'Escolha pelo menos um perfil.';
    return found;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setApiErrors([]);
    const first = (['name', 'email', 'msisdn', 'password'] as const).find((key) => found[key]);
    if (first) {
      document.getElementById(`utilizador-${first}`)?.focus();
      return;
    }
    if (found.roles) return;

    const dto = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      msisdn: normalizeMsisdn(form.msisdn),
      ...(form.password ? { password: form.password } : {}),
      roles: [...new Set([...selected, ...keptRoleIds])],
    };

    saveUser(
      { id: user?.id, dto },
      {
        onSuccess: () => {
          if (!editing)
            showToast(`Conta de ${dto.name} criada. Entregue-lhe o e-mail e a password por um canal seguro.`);
          else if (isSelf) showToast('Alterações guardadas. Inicie sessão de novo para continuar.');
          else showToast('Alterações guardadas.');
          onClose();
        },
        onError: (error) => {
          // A API actual exige a password também ao editar (400 sem ela).
          if (editing && !form.password && getApiStatus(error) === 400) {
            setErrors({
              password:
                'A versão actual da API só grava alterações com uma password nova. Indique uma: passa a ser a password desta pessoa.',
            });
            document.getElementById('utilizador-password')?.focus();
            return;
          }
          setApiErrors(getApiErrorMessages(error, 'Não foi possível guardar o utilizador.'));
        },
      },
    );
  };

  const fill = () => {
    set('password', generatePassword());
    setShowPassword(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      showToast('Password copiada.');
    } catch {
      showToast('Não foi possível copiar. Seleccione a password e copie à mão.', 'error');
    }
  };

  const field = (key: 'name' | 'email' | 'msisdn', label: string, props: Record<string, string>) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`utilizador-${key}`}>
        {label}
      </label>
      <input
        id={`utilizador-${key}`}
        className={`form-input${errors[key] ? ' error' : ''}`}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `utilizador-${key}-erro` : undefined}
        {...props}
      />
      {errors[key] && (
        <span className="form-error" id={`utilizador-${key}-erro`}>
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <form className="utilizador-form" onSubmit={submit} noValidate>
      <div className="settings-grid">
        <div className="form-group-full">
          {field('name', 'Nome', {
            autoComplete: 'off',
            placeholder: 'Ex.: Maria Domingos',
          })}
        </div>
        {field('email', 'E-mail (para entrar)', {
          type: 'email',
          autoComplete: 'off',
          spellCheck: 'false',
          placeholder: 'nome@pumangol.co.ao',
        })}
        {field('msisdn', 'Telefone', {
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'off',
          placeholder: '923 000 000',
        })}

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="utilizador-password">
            {editing ? 'Nova password' : 'Password'}
          </label>
          <div className="utilizador-password">
            <input
              id="utilizador-password"
              className={`form-input${errors.password ? ' error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              placeholder={editing ? 'Deixe em branco para manter a actual' : `Pelo menos ${MIN_PASSWORD} caracteres`}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="utilizador-password-ajuda"
            />
            <button
              type="button"
              className="utilizador-password__botao"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Esconder a password' : 'Mostrar a password'}
              title={showPassword ? 'Esconder' : 'Mostrar'}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
            {form.password && (
              <button
                type="button"
                className="utilizador-password__botao"
                onClick={copy}
                aria-label="Copiar a password"
                title="Copiar"
              >
                <Copy size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={fill}>
              <KeyRound size={14} aria-hidden="true" />
              Gerar
            </button>
          </div>
          {errors.password ? (
            <span className="form-error" id="utilizador-password-ajuda">
              {errors.password}
            </span>
          ) : (
            <span className="settings-help" id="utilizador-password-ajuda">
              {editing
                ? 'Só para trocar a password desta pessoa.'
                : 'Entregue-a à pessoa por um canal seguro. Pode mudá-la depois de entrar.'}
            </span>
          )}
        </div>
      </div>

      <fieldset
        className="utilizador-perfis-escolha"
        aria-describedby={errors.roles ? 'utilizador-perfis-erro' : undefined}
      >
        <legend className="form-label">Perfis</legend>
        <p className="settings-help">
          O perfil define o que a pessoa pode fazer no back-office.{' '}
          <Link to="/backoffice/permissoes" onClick={onClose}>
            Ver as permissões de cada perfil
          </Link>
        </p>
        {rolesError ? (
          <p className="form-error">Não foi possível carregar os perfis. Feche e tente novamente.</p>
        ) : (
          <div className="utilizador-perfis-lista">
            {teamRoles.map((role) => {
              const locked = lockedReason(role);
              const checked = selected.includes(role.id);
              return (
                <label key={role.id} className={`settings-check${locked ? ' utilizador-perfil--bloqueado' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={Boolean(locked) && checked}
                    onChange={(event) => toggleRole(role.id, event.target.checked)}
                  />
                  <span>
                    <strong>{roleDisplayName(role.name)}</strong>
                    <small>{roleDescription(role)}</small>
                    {locked && checked && <small className="utilizador-perfil__aviso">{locked}</small>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {keptRoleIds.length > 0 && (
          <p className="settings-help">Também tem conta de cliente na loja online; essa conta mantém-se.</p>
        )}
        {errors.roles && (
          <span className="form-error" id="utilizador-perfis-erro" role="alert">
            {errors.roles}
          </span>
        )}
      </fieldset>

      {editing && (
        <p className="backoffice-note utilizador-form__nota">
          {isSelf
            ? 'Ao guardar, a sua sessão termina e terá de entrar de novo.'
            : `Ao guardar, ${firstName(user.name) || 'esta pessoa'} terá de iniciar sessão de novo.`}
        </p>
      )}

      {apiErrors.length > 0 && (
        <div className="settings-errors" role="alert">
          {apiErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <div className="settings-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending || rolesError}>
          {isPending ? 'A guardar…' : editing ? 'Guardar alterações' : 'Criar utilizador'}
        </button>
      </div>
    </form>
  );
}

export function BackofficeUsersPage() {
  useDocumentTitle('Utilizadores');
  const { user: me } = useAuth();
  const { showToast } = useToast();
  const usersQuery = useUsers();
  const rolesQuery = useRoles();
  const { mutate: removeUser, isPending: deleting } = useDeleteUser();

  const [scope, setScope] = useState<Scope>('equipa');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<{ open: boolean; user: AuthUser | null }>({
    open: false,
    user: null,
  });
  const [toDelete, setToDelete] = useState<AuthUser | null>(null);

  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data]);
  const total = usersQuery.data?.total ?? 0;
  const roles = rolesQuery.data ?? [];
  const adminCount = users.filter(isAdmin).length;

  const counts: Record<Scope, number> = {
    equipa: users.filter(isTeamUser).length,
    clientes: users.filter((user) => !isTeamUser(user)).length,
    todos: users.length,
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return users.filter((user) => {
      if (scope === 'equipa' && !isTeamUser(user)) return false;
      if (scope === 'clientes' && isTeamUser(user)) return false;
      if (roleFilter && !(user.roles ?? []).some((role) => role.name === roleFilter)) return false;
      if (!term) return true;
      return (
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        (digits.length >= 3 && user.msisdn?.includes(digits))
      );
    });
  }, [users, scope, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const rows = visible.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);
  const filtered = Boolean(search.trim() || roleFilter);

  const changeScope = (next: Scope) => {
    setScope(next);
    setPage(0);
  };

  const deleteBlock = (user: AuthUser): string | null => {
    if (user.id === me?.id) return 'Não pode eliminar a sua própria conta.';
    if (isAdmin(user) && adminCount <= 1) return 'É o único administrador.';
    return null;
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    removeUser(toDelete.id, {
      onSuccess: () => {
        showToast(`Conta de ${toDelete.name} eliminada.`);
        setToDelete(null);
      },
      onError: (error) =>
        showToast(
          getApiErrorMessage(error, 'Não foi possível eliminar a conta. Pode ter registos associados.'),
          'error',
        ),
    });
  };

  const closeModal = () => setModal({ open: false, user: null });

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Utilizadores</h1>
              <p className="section-subtitle">
                Contas com acesso ao back-office. O perfil de cada pessoa define as permissões.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, user: null })}>
              <UserPlus size={18} aria-hidden="true" />
              Novo utilizador
            </button>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {usersQuery.isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar utilizadores…</p>
          </div>
        ) : usersQuery.isError ? (
          <div className="backoffice-empty">
            <p>{getApiErrorMessage(usersQuery.error, 'Não foi possível carregar os utilizadores.')}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => usersQuery.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="utilizadores-separadores" role="tablist" aria-label="Contas">
              {SCOPES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={scope === id}
                  aria-controls="utilizadores-lista"
                  className="utilizadores-separador"
                  onClick={() => changeScope(id)}
                >
                  {label}
                  <span className="utilizadores-separador__n">{counts[id]}</span>
                </button>
              ))}
            </div>

            <div className="utilizadores-filtros">
              <div className="utilizadores-pesquisa">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  className="form-input"
                  placeholder="Nome, e-mail ou telefone"
                  aria-label="Procurar utilizador"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <Select
                value={roleFilter}
                onChange={(next) => {
                  setRoleFilter(next);
                  setPage(0);
                }}
                placeholder="Todos os perfis"
                options={roles.map((role) => ({
                  value: role.name,
                  label: roleDisplayName(role.name),
                }))}
              />
              {filtered && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearch('');
                    setRoleFilter('');
                    setPage(0);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                  Limpar filtros
                </button>
              )}
            </div>

            {total > users.length && (
              <p className="backoffice-note">
                A mostrar as primeiras {USERS_PAGE_SIZE} de {total} contas, por ordem de nome.
              </p>
            )}

            <div id="utilizadores-lista" role="tabpanel">
              <p className="utilizadores-resumo" aria-live="polite">
                {plural(visible.length, 'conta', 'contas')}
              </p>

              {rows.length === 0 ? (
                <div className="backoffice-empty">
                  <p>
                    {filtered
                      ? 'Nenhuma conta corresponde à pesquisa.'
                      : scope === 'clientes'
                        ? 'Não há contas de clientes registadas.'
                        : 'Ainda não há contas nesta lista.'}
                  </p>
                </div>
              ) : (
                <div className="backoffice-table-wrap">
                  <table className="backoffice-table utilizadores-tabela">
                    <thead>
                      <tr>
                        <th>Utilizador</th>
                        <th>Telefone</th>
                        <th>Perfis</th>
                        <th>Acções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((user) => {
                        const blocked = deleteBlock(user);
                        const self = user.id === me?.id;
                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="utilizadores-pessoa">
                                <span className="bo-avatar utilizadores-pessoa__avatar" aria-hidden="true">
                                  {initials(user.name) || '?'}
                                </span>
                                <span className="utilizadores-pessoa__texto">
                                  <span className="backoffice-book-title">
                                    {user.name}
                                    {self && <span className="utilizadores-voce">Você</span>}
                                  </span>
                                  <span className="backoffice-book-meta">{user.email}</span>
                                </span>
                              </div>
                            </td>
                            <td className="utilizadores-telefone">{user.msisdn ? formatPhone(user.msisdn) : '—'}</td>
                            <td>
                              <RoleBadges roles={user.roles ?? []} />
                            </td>
                            <td>
                              <div className="backoffice-actions">
                                <button
                                  type="button"
                                  className="backoffice-book-delete"
                                  onClick={() => setModal({ open: true, user })}
                                  aria-label={`Editar ${user.name}`}
                                  title="Editar"
                                >
                                  <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="backoffice-book-delete"
                                  onClick={() => setToDelete(user)}
                                  disabled={Boolean(blocked)}
                                  aria-label={blocked ? `${user.name}: ${blocked}` : `Eliminar ${user.name}`}
                                  title={blocked ?? 'Eliminar'}
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={modal.open}
        onClose={closeModal}
        title={modal.user ? 'Editar utilizador' : 'Novo utilizador'}
        maxWidth="640px"
      >
        <UserForm
          key={modal.user?.id ?? 'novo'}
          user={modal.user}
          roles={roles}
          rolesError={rolesQuery.isError}
          isSelf={modal.user?.id === me?.id}
          onlyAdmin={adminCount <= 1}
          onClose={closeModal}
        />
      </Modal>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar conta"
        message={
          toDelete
            ? `Eliminar a conta de ${toDelete.name} (${toDelete.email})? A pessoa deixa de entrar no back-office. A eliminação é definitiva.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleting}
      />
    </div>
  );
}
