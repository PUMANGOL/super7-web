import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { getApiErrorMessage, getApiErrorMessages } from '../../api/client';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { hasApiFeature } from '../../config/store';
import { useToast } from '../../context/toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useDeleteRole, useRoles, useSaveRole, useUsers } from '../../hooks/useUsers';
import type { AuthRole } from '../../types/api';
import {
  CUSTOMER_ROLE,
  PERMISSION_INFO,
  PERMISSION_KEYS,
  roleDescription,
  roleDisplayName,
  rolePermissions,
  TEAM_ROLES,
  type Permission,
  type RoleName,
} from '../../utils/auth';
import { plural } from '../../utils/format';
import './BackofficeSettingsPage.css';
import './BackofficeUsersPage.css';

const AREAS = [...new Set(PERMISSION_KEYS.map((key) => PERMISSION_INFO[key].area))];
const MAX_ROLE_NAME = 40;

/** Perfis que vêm com a API: não se mudam o nome nem se eliminam. */
const isSystemRole = (role: AuthRole) => role.name === CUSTOMER_ROLE || TEAM_ROLES.includes(role.name as RoleName);

const sameSet = (a: Permission[], b: Permission[]) => a.length === b.length && a.every((key) => b.includes(key));

const toCodes = (keys: Permission[]) => keys.map((key) => PERMISSION_INFO[key].code);

/** Marcar uma permissão marca a que ela pressupõe; desmarcar desmarca as que dependem dela. */
function togglePermission(current: Permission[], key: Permission, checked: boolean): Permission[] {
  const next = new Set(current);
  if (checked) {
    next.add(key);
    const required = PERMISSION_INFO[key].requires;
    if (required) next.add(required);
  } else {
    next.delete(key);
    for (const other of PERMISSION_KEYS) if (PERMISSION_INFO[other].requires === key) next.delete(other);
  }
  return PERMISSION_KEYS.filter((item) => next.has(item));
}

function RoleForm({ role, roles, onClose }: { role: AuthRole | null; roles: AuthRole[]; onClose: () => void }) {
  const { showToast } = useToast();
  const { mutate: saveRole, isPending } = useSaveRole();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [base, setBase] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, ' ');
    const taken = roles.some(
      (other) =>
        other.id !== role?.id &&
        [other.name, roleDisplayName(other.name)].some((label) => label.toLowerCase() === trimmed.toLowerCase()),
    );
    const error = !trimmed
      ? 'Indique o nome do perfil.'
      : trimmed.length > MAX_ROLE_NAME
        ? `Até ${MAX_ROLE_NAME} caracteres.`
        : taken
          ? 'Já existe um perfil com este nome.'
          : null;
    setNameError(error);
    if (error) {
      document.getElementById('perfil-nome')?.focus();
      return;
    }

    const baseRole = roles.find((item) => item.id === base);
    const permissions = role ? rolePermissions(role) : baseRole ? rolePermissions(baseRole) : [];
    saveRole(
      {
        id: role?.id,
        dto: {
          name: trimmed,
          description: description.trim() || null,
          permissions: toCodes(permissions),
        },
      },
      {
        onSuccess: () => {
          showToast(role ? 'Perfil actualizado.' : `Perfil "${trimmed}" criado. Marque as permissões na tabela.`);
          onClose();
        },
        onError: (saveError) => setApiErrors(getApiErrorMessages(saveError, 'Não foi possível guardar o perfil.')),
      },
    );
  };

  return (
    <form className="utilizador-form" onSubmit={submit} noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="perfil-nome">
          Nome
        </label>
        <input
          id="perfil-nome"
          className={`form-input${nameError ? ' error' : ''}`}
          value={name}
          maxLength={MAX_ROLE_NAME + 10}
          placeholder="Ex.: Armazém"
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
          aria-invalid={nameError ? true : undefined}
        />
        {nameError && <span className="form-error">{nameError}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="perfil-descricao">
          Descrição (opcional)
        </label>
        <input
          id="perfil-descricao"
          className="form-input"
          value={description}
          maxLength={160}
          placeholder="Ex.: Prepara as encomendas e marca-as prontas para levantar."
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      {!role && (
        <div className="form-group">
          <label className="form-label" htmlFor="perfil-base">
            Começar com as permissões de
          </label>
          <Select
            id="perfil-base"
            value={base}
            onChange={setBase}
            placeholder="Nenhum (sem permissões)"
            options={roles
              .filter((item) => item.name !== CUSTOMER_ROLE)
              .map((item) => ({
                value: item.id,
                label: roleDisplayName(item.name),
              }))}
          />
        </div>
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
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'A guardar…' : role ? 'Guardar' : 'Criar perfil'}
        </button>
      </div>
    </form>
  );
}

export function BackofficePermissionsPage() {
  useDocumentTitle('Perfis e permissões');
  const editable = hasApiFeature('role-permissions');
  const { showToast } = useToast();
  const rolesQuery = useRoles();
  const usersQuery = useUsers();
  const { mutateAsync: saveRoleAsync } = useSaveRole();
  const { mutate: removeRole, isPending: deleting } = useDeleteRole();

  const [draft, setDraft] = useState<Record<string, Permission[]>>({});
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; role: AuthRole | null }>({
    open: false,
    role: null,
  });
  const [toDelete, setToDelete] = useState<AuthRole | null>(null);

  const fromApi = Boolean(rolesQuery.data);
  const columns = useMemo<AuthRole[]>(() => {
    const team = rolesQuery.data?.filter((role) => role.name !== CUSTOMER_ROLE);
    // Sem a lista da API, mostram-se as regras fixas dos perfis de equipa.
    return team && team.length > 0 ? team : TEAM_ROLES.map((name) => ({ id: name, name }));
  }, [rolesQuery.data]);
  const canEdit = editable && fromApi;

  const peopleWith = (role: AuthRole): number | null => {
    const users = usersQuery.data?.users;
    return users ? users.filter((user) => (user.roles ?? []).some((item) => item.name === role.name)).length : null;
  };

  const permissionsOf = (role: AuthRole) => draft[role.id] ?? rolePermissions(role);
  const changedRoles = columns.filter((role) => draft[role.id]);

  const toggle = (role: AuthRole, key: Permission, checked: boolean) => {
    const next = togglePermission(permissionsOf(role), key, checked);
    setDraft((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== role.id));
      return sameSet(next, rolePermissions(role)) ? rest : { ...rest, [role.id]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    let ignored = false;
    try {
      for (const role of changedRoles) {
        const saved = await saveRoleAsync({
          id: role.id,
          dto: {
            name: role.name,
            description: role.description ?? null,
            permissions: toCodes(draft[role.id]),
          },
        });
        if (!Array.isArray(saved?.permissions)) ignored = true;
      }
      setDraft({});
      showToast(
        ignored
          ? 'A API respondeu, mas ainda não guarda as permissões dos perfis.'
          : 'Permissões guardadas. Valem a partir do próximo pedido de cada pessoa.',
        ignored ? 'error' : 'success',
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Não foi possível guardar as permissões.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    removeRole(toDelete.id, {
      onSuccess: () => {
        showToast(`Perfil "${roleDisplayName(toDelete.name)}" eliminado.`);
        setDraft((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== toDelete.id)));
        setToDelete(null);
      },
      onError: (error) =>
        showToast(
          getApiErrorMessage(error, 'Não foi possível eliminar o perfil. Pode ainda estar atribuído.'),
          'error',
        ),
    });
  };

  const cell = (role: AuthRole, key: Permission) => {
    const has = permissionsOf(role).includes(key);
    const label = `${roleDisplayName(role.name)}: ${PERMISSION_INFO[key].label}`;
    if (canEdit) {
      const admin = role.name === 'ADMIN';
      return (
        <input
          type="checkbox"
          className="permissoes-caixa"
          checked={admin || has}
          disabled={admin || saving}
          onChange={(event) => toggle(role, key, event.target.checked)}
          aria-label={label}
          title={admin ? 'O administrador tem sempre todas as permissões.' : undefined}
        />
      );
    }
    return has ? (
      <span className="permissoes-sim" title="Pode">
        <Check size={14} strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">{label}: sim</span>
      </span>
    ) : (
      <span className="permissoes-nao" title="Não pode">
        <Minus size={14} aria-hidden="true" />
        <span className="sr-only">{label}: não</span>
      </span>
    );
  };

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Perfis e permissões</h1>
              <p className="section-subtitle">
                O que cada perfil pode fazer no back-office. Para dar ou tirar acesso a uma pessoa, mude o perfil dela
                em <Link to="/backoffice/utilizadores">Utilizadores</Link>.
              </p>
            </div>
            {canEdit && (
              <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, role: null })}>
                <Plus size={18} aria-hidden="true" />
                Novo perfil
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {!editable && (
          <p className="backoffice-note">
            Por agora as permissões de cada perfil estão fixas na API e não se mudam aqui. A tabela passa a ser
            editável, e passa a ser possível criar perfis novos, quando a API guardar as permissões de cada perfil.
          </p>
        )}
        {rolesQuery.isError && (
          <p className="backoffice-note">
            {getApiErrorMessage(rolesQuery.error, 'Não foi possível carregar os perfis.')} A tabela mostra as regras
            fixas dos perfis de equipa.
          </p>
        )}

        {rolesQuery.isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar perfis…</p>
          </div>
        ) : (
          <>
            <div className="permissoes-tabela-wrap">
              <table className="permissoes-tabela">
                <caption className="sr-only">Permissões de cada perfil</caption>
                <thead>
                  <tr>
                    <th scope="col">Permissão</th>
                    {columns.map((role) => {
                      const count = peopleWith(role);
                      return (
                        <th
                          key={role.id}
                          scope="col"
                          title={roleDescription({
                            ...role,
                            permissions: toCodes(permissionsOf(role)),
                          })}
                        >
                          <span className="permissoes-perfil">
                            <strong>{roleDisplayName(role.name)}</strong>
                            {count !== null && <small>{plural(count, 'pessoa', 'pessoas')}</small>}
                            {canEdit && !isSystemRole(role) && (
                              <span className="permissoes-perfil__accoes">
                                <button
                                  type="button"
                                  onClick={() => setModal({ open: true, role })}
                                  aria-label={`Mudar o nome de ${role.name}`}
                                  title="Mudar o nome"
                                >
                                  <Pencil size={13} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setToDelete(role)}
                                  aria-label={`Eliminar o perfil ${role.name}`}
                                  title="Eliminar"
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {AREAS.map((area) => (
                    <Fragment key={area}>
                      <tr className="permissoes-area">
                        <td colSpan={columns.length + 1}>{area}</td>
                      </tr>
                      {PERMISSION_KEYS.filter((key) => PERMISSION_INFO[key].area === area).map((key) => (
                        <tr key={key}>
                          <th scope="row">
                            <span className="permissoes-nome">
                              <strong>{PERMISSION_INFO[key].label}</strong>
                              <small>{PERMISSION_INFO[key].help}</small>
                            </span>
                          </th>
                          {columns.map((role) => {
                            const changed =
                              Boolean(draft[role.id]) &&
                              draft[role.id].includes(key) !== rolePermissions(role).includes(key);
                            return (
                              <td key={role.id} className={changed ? 'permissoes-alterada' : undefined}>
                                {cell(role, key)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="permissoes-legenda">
              {!canEdit && (
                <>
                  <span>
                    <span className="permissoes-sim" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    Pode
                  </span>
                  <span>
                    <span className="permissoes-nao" aria-hidden="true">
                      <Minus size={12} />
                    </span>
                    Não pode
                  </span>
                </>
              )}
              <span>O administrador tem sempre todas as permissões.</span>
              {canEdit && (
                <span>Algumas permissões pressupõem outras (ex.: mudar o estado exige ver as encomendas).</span>
              )}
            </p>

            {changedRoles.length > 0 && (
              <div className="permissoes-barra" role="region" aria-label="Alterações por gravar">
                <p>
                  {changedRoles.length === 1
                    ? `Perfil ${roleDisplayName(changedRoles[0].name)} alterado`
                    : `${changedRoles.length} perfis alterados`}
                </p>
                <button type="button" className="btn btn-outline" onClick={() => setDraft({})} disabled={saving}>
                  Desfazer
                </button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar permissões'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, role: null })}
        title={modal.role ? 'Mudar o perfil' : 'Novo perfil'}
        maxWidth="520px"
      >
        <RoleForm
          key={modal.role?.id ?? 'novo'}
          role={modal.role}
          roles={rolesQuery.data ?? []}
          onClose={() => setModal({ open: false, role: null })}
        />
      </Modal>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar perfil"
        message={
          toDelete
            ? `Eliminar o perfil "${roleDisplayName(toDelete.name)}"? ${
                peopleWith(toDelete)
                  ? `${plural(peopleWith(toDelete) ?? 0, 'pessoa perde', 'pessoas perdem')} as permissões dele.`
                  : 'Ninguém o tem atribuído.'
              } A eliminação é definitiva.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleting}
      />
    </div>
  );
}
