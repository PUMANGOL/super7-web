import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessages } from '../../api/client';
import { fetchStoreSettings, updateStoreSettings } from '../../api/settings';
import {
  CHRISTMAS_THEME_DEFAULT,
  PAYMENT_METHOD_LABELS,
  STORE_PAYMENT_METHODS,
  type PaymentMethod,
  type PickupMode,
} from '../../config/store';
import { useExpressWindow } from '../../catalog/useStoreSettings';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { usePickupPosts } from '../../hooks/usePickupPosts';
import type { StoreSettings } from '../../types/api';
import { formatDate } from '../../utils/helpers';
import './BackofficeSettingsPage.css';

const SETTINGS_KEY = ['store-settings'];

const METHOD_NOTES: Partial<Record<PaymentMethod, string>> = {
  MULTICAIXA_EXPRESS:
    'O cliente recebe o pedido na aplicação e tem {prazo} para aceitar. A confirmação é automática. Só aparece na loja com o serviço de pagamentos ligado na API.',
  IBAN: 'O cliente transfere e envia o comprovativo (PDF ou imagem). A equipa confirma o pagamento no detalhe da encomenda.',
};

interface FormState {
  paymentMethods: PaymentMethod[];
  pickupMode: PickupMode;
  fixedPickupPostId: string;
  homeDeliveryEnabled: boolean;
  giftEnabled: boolean;
  iban: string;
  ibanHolder: string;
  ibanBank: string;
  expressPosId: string;
  christmasTheme: boolean;
}

function toForm(settings: StoreSettings): FormState {
  return {
    paymentMethods: settings.paymentMethods ?? [],
    pickupMode: settings.pickupMode ?? 'CUSTOMER_CHOICE',
    fixedPickupPostId: settings.fixedPickupPostId ?? '',
    homeDeliveryEnabled: Boolean(settings.homeDeliveryEnabled),
    giftEnabled: Boolean(settings.giftEnabled),
    iban: settings.iban ?? '',
    ibanHolder: settings.ibanHolder ?? '',
    ibanBank: settings.ibanBank ?? '',
    expressPosId: settings.expressPosId ?? '',
    christmasTheme: settings.christmasTheme ?? CHRISTMAS_THEME_DEFAULT,
  };
}

function validate(form: FormState, posIdSupported: boolean): string[] {
  const errors: string[] = [];
  if (form.paymentMethods.length === 0) errors.push('Escolha pelo menos uma forma de pagamento.');
  if (posIdSupported && form.paymentMethods.includes('MULTICAIXA_EXPRESS')) {
    const posId = form.expressPosId.trim();
    if (!posId) errors.push('Indique o posId do posto que recebe os pagamentos Multicaixa Express.');
    else if (!/^\d{1,20}$/.test(posId)) errors.push('O posId do Multicaixa Express só pode ter algarismos (ex.: 421056).');
  }
  if (form.paymentMethods.includes('IBAN')) {
    if (!form.iban.trim()) errors.push('Indique o IBAN para o pagamento por transferência.');
    if (!form.ibanHolder.trim()) errors.push('Indique o titular da conta.');
  }
  if (form.pickupMode === 'FIXED' && !form.fixedPickupPostId) errors.push('Escolha a loja fixa de levantamento.');
  return errors;
}

/** Definições da loja: formas de pagamento, ponto de recolha, entregas e cartão de oferta (só ADMIN altera). */
export function BackofficeSettingsPage() {
  useDocumentTitle('Definições da loja');
  const { can } = useAuth();
  const canEdit = can('manageSettings');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchStoreSettings });

  if (settings.isLoading) {
    return (
      <div className="backoffice-page">
        <div className="backoffice-empty">
          <p>A carregar as definições…</p>
        </div>
      </div>
    );
  }
  if (settings.isError || !settings.data) {
    return (
      <div className="backoffice-page">
        <div className="backoffice-empty">
          <p>Não foi possível carregar as definições da loja.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => settings.refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <SettingsForm
      key={settings.data.updatedAt ?? 'inicial'}
      initial={settings.data}
      canEdit={canEdit}
      onSaved={(saved) => {
        queryClient.setQueryData(SETTINGS_KEY, saved);
        // O checkout deste browser passa a usar as definições novas.
        void queryClient.invalidateQueries({ queryKey: ['checkout-options'] });
        showToast('Definições guardadas. Aplicam-se às encomendas seguintes.');
      }}
    />
  );
}

function SettingsForm({
  initial,
  canEdit,
  onSaved,
}: {
  initial: StoreSettings;
  canEdit: boolean;
  onSaved: (settings: StoreSettings) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const posts = usePickupPosts();
  const expressWindow = useExpressWindow();
  const save = useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: (saved) => {
      setErrors([]);
      onSaved(saved);
    },
    onError: (error) => setErrors(getApiErrorMessages(error, 'Não foi possível guardar as definições.')),
  });

  const themeSupported = typeof initial.christmasTheme === 'boolean';
  // A API anterior não devolve o posId: o campo só aparece depois de publicar a API nova.
  const posIdSupported = typeof initial.expressPosId === 'string';
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleMethod = (method: PaymentMethod, checked: boolean) =>
    set(
      'paymentMethods',
      STORE_PAYMENT_METHODS.filter((item) => (item === method ? checked : form.paymentMethods.includes(item))),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form, posIdSupported);
    setErrors(found);
    if (found.length > 0) return;
    save.mutate({
      paymentMethods: form.paymentMethods,
      pickupMode: form.pickupMode,
      fixedPickupPostId: form.pickupMode === 'FIXED' ? form.fixedPickupPostId : null,
      homeDeliveryEnabled: form.homeDeliveryEnabled,
      giftEnabled: form.giftEnabled,
      iban: form.iban.trim() || null,
      ibanHolder: form.ibanHolder.trim() || null,
      ibanBank: form.ibanBank.trim() || null,
      ...(posIdSupported ? { expressPosId: form.expressPosId.trim() } : {}),
      ...(themeSupported ? { christmasTheme: form.christmasTheme } : {}),
    });
  };

  const ibanOn = form.paymentMethods.includes('IBAN');
  const expressOn = form.paymentMethods.includes('MULTICAIXA_EXPRESS');
  const disabled = !canEdit || save.isPending;

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Definições da loja</h1>
              <p className="section-subtitle">
                O que a loja oferece no checkout. As alterações aplicam-se às encomendas seguintes.
                {initial.updatedAt && (
                  <> Última alteração: {formatDate(initial.updatedAt)}{initial.updatedBy ? ` por ${initial.updatedBy}` : ''}.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {!canEdit && (
          <p className="backoffice-note">Só os administradores podem alterar as definições da loja.</p>
        )}

        <form className="settings-form" onSubmit={submit} noValidate>
          <fieldset className="settings-card" disabled={disabled}>
            <legend>Formas de pagamento</legend>
            <p className="settings-help">Marque as que o cliente pode escolher. Tem de haver pelo menos uma.</p>
            {STORE_PAYMENT_METHODS.map((method) => (
              <label key={method} className="settings-check">
                <input
                  type="checkbox"
                  checked={form.paymentMethods.includes(method)}
                  onChange={(event) => toggleMethod(method, event.target.checked)}
                />
                <span>
                  <strong>{PAYMENT_METHOD_LABELS[method]}</strong>
                  <small>{METHOD_NOTES[method]?.replace('{prazo}', expressWindow.label)}</small>
                </span>
              </label>
            ))}

            {expressOn && posIdSupported && (
              <div className="settings-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-posid">
                    posId do Multicaixa Express
                  </label>
                  <input
                    id="settings-posid"
                    className="form-input"
                    value={form.expressPosId}
                    onChange={(event) => set('expressPosId', event.target.value)}
                    placeholder="421056"
                    inputMode="numeric"
                    maxLength={20}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="settings-help">
                    Código do posto que recebe os pagamentos Multicaixa Express (421056 = PA Zanca). Os pagamentos já
                    pedidos continuam com o posId com que saíram.
                  </span>
                </div>
              </div>
            )}

            {ibanOn && (
              <div className="settings-grid">
                <div className="form-group form-group-full">
                  <label className="form-label" htmlFor="settings-iban">
                    IBAN
                  </label>
                  <input
                    id="settings-iban"
                    className="form-input"
                    value={form.iban}
                    onChange={(event) => set('iban', event.target.value)}
                    placeholder="AO06 0000 0000 0000 0000 0000 0"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="settings-help">A API confirma os dígitos de controlo; um IBAN mal copiado é recusado.</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-holder">
                    Titular da conta
                  </label>
                  <input
                    id="settings-holder"
                    className="form-input"
                    value={form.ibanHolder}
                    onChange={(event) => set('ibanHolder', event.target.value)}
                    placeholder="Pumangol, S.A."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-bank">
                    Banco <small>(opcional)</small>
                  </label>
                  <input
                    id="settings-bank"
                    className="form-input"
                    value={form.ibanBank}
                    onChange={(event) => set('ibanBank', event.target.value)}
                  />
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="settings-card" disabled={disabled}>
            <legend>Pontos de recolha</legend>
            <label className="settings-check">
              <input
                type="radio"
                name="pickupMode"
                checked={form.pickupMode === 'CUSTOMER_CHOICE'}
                onChange={() => set('pickupMode', 'CUSTOMER_CHOICE')}
              />
              <span>
                <strong>À escolha do cliente</strong>
                <small>O cliente escolhe uma das lojas de levantamento activas.</small>
              </span>
            </label>
            <label className="settings-check">
              <input
                type="radio"
                name="pickupMode"
                checked={form.pickupMode === 'FIXED'}
                onChange={() => set('pickupMode', 'FIXED')}
              />
              <span>
                <strong>Loja fixa</strong>
                <small>Todas as encomendas são levantadas (e as entregas preparadas) na loja indicada.</small>
              </span>
            </label>
            {form.pickupMode === 'FIXED' && (
              <div className="form-group">
                <label className="form-label" htmlFor="settings-post">
                  Loja fixa
                </label>
                <select
                  id="settings-post"
                  className="form-select"
                  value={form.fixedPickupPostId}
                  onChange={(event) => set('fixedPickupPostId', event.target.value)}
                  disabled={posts.isLoading}
                >
                  <option value="">{posts.isLoading ? 'A carregar lojas…' : 'Escolha a loja'}</option>
                  {(posts.data ?? []).map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.zone ? `${post.name} · ${post.zone}` : post.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          <fieldset className="settings-card" disabled={disabled}>
            <legend>Serviços</legend>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.homeDeliveryEnabled}
                onChange={(event) => set('homeDeliveryEnabled', event.target.checked)}
              />
              <span>
                <strong>Permitir entrega ao domicílio</strong>
                <small>A taxa e as zonas servidas estão na configuração do servidor.</small>
              </span>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.giftEnabled}
                onChange={(event) => set('giftEnabled', event.target.checked)}
              />
              <span>
                <strong>Permitir cartão de oferta</strong>
                <small>O cliente indica para quem é e escreve uma mensagem para o cartão.</small>
              </span>
            </label>
          </fieldset>

          <fieldset className="settings-card" disabled={disabled}>
            <legend>Tema da loja</legend>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.christmasTheme}
                disabled={!themeSupported}
                onChange={(event) => set('christmasTheme', event.target.checked)}
              />
              <span>
                <strong>Tema de Natal</strong>
                <small>
                  Adereços natalícios na loja: gorro no logótipo, enfeites e luzes no banner, azevinho nas cestas.
                  Só aparece durante a campanha de Natal; desligado, a loja fica com o aspecto habitual.
                </small>
              </span>
            </label>
            {!themeSupported && (
              <p className="settings-help">
                A API ainda não guarda esta opção: fica disponível depois de publicar a nova versão da API. Até lá o tema
                está ligado durante a campanha de Natal.
              </p>
            )}
            <p className="settings-help">
              Pré-visualizar:{' '}
              <a href="/?tema=natal" target="_blank" rel="noreferrer">
                com o tema de Natal
              </a>{' '}
              ·{' '}
              <a href="/?tema=classico" target="_blank" rel="noreferrer">
                sem o tema
              </a>
              . Só muda a página aberta, não grava nada.
            </p>
          </fieldset>

          {errors.length > 0 && (
            <div className="settings-errors" role="alert">
              {errors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setForm(toForm(initial));
                  setErrors([]);
                }}
                disabled={save.isPending}
              >
                Repor
              </button>
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'A guardar…' : 'Guardar definições'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
