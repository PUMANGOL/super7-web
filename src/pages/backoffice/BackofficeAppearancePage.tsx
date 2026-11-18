import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { getApiErrorMessages } from '../../api/client';
import { BackofficeWelcome } from '../../components/backoffice/BackofficeWelcome';
import {
  DEFAULT_THEME,
  normalizeHex,
  sameTheme,
  THEME_FIELDS,
  THEME_KEYS,
  THEME_PRESETS,
  themeProblems,
  type BackofficeTheme,
  type ThemeKey,
} from '../../components/backoffice/theme/theme';
import { useBackofficeTheme } from '../../components/backoffice/theme/themeContext';
import { useToast } from '../../context/toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/helpers';
import { useNow } from './dashboard/hooks';
import './BackofficeSettingsPage.css';
import './BackofficeAppearancePage.css';

/** Aparência do back-office: o ADMIN escolhe as cores; o back-office mostra-as logo, antes de gravar. */
export function BackofficeAppearancePage() {
  useDocumentTitle('Aparência do back-office');
  const { theme } = useBackofficeTheme();
  // Gravadas cores novas, o formulário recomeça a partir delas.
  return <AppearanceForm key={THEME_KEYS.map((key) => theme[key]).join()} initial={theme} />;
}

function AppearanceForm({ initial }: { initial: BackofficeTheme }) {
  const { shared, updatedAt, updatedBy, setPreview, saveTheme, saving } = useBackofficeTheme();
  const { showToast } = useToast();
  const now = useNow(60_000);
  const [draft, setDraft] = useState(initial);
  const [texts, setTexts] = useState<BackofficeTheme>(initial);
  const [errors, setErrors] = useState<string[]>([]);

  // Ao sair da página sem gravar, o back-office volta às cores gravadas.
  useEffect(() => () => setPreview(null), [setPreview]);

  const update = (next: BackofficeTheme) => {
    setDraft(next);
    setTexts(next);
    setErrors([]);
    setPreview(sameTheme(next, initial) ? null : next);
  };

  const typeColor = (key: ThemeKey, value: string) => {
    setTexts((current) => ({ ...current, [key]: value }));
    const hex = normalizeHex(value);
    if (hex && hex !== draft[key]) {
      const next = { ...draft, [key]: hex };
      setDraft(next);
      setErrors([]);
      setPreview(sameTheme(next, initial) ? null : next);
    }
  };

  const changed = !sameTheme(draft, initial);
  const problems = themeProblems(draft);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || problems.length > 0) return;
    try {
      await saveTheme(draft);
      showToast(
        shared
          ? 'Cores guardadas. A equipa vê-as ao abrir ou voltar ao back-office.'
          : 'Cores guardadas neste browser.',
      );
    } catch (error) {
      setErrors(getApiErrorMessages(error, 'Não foi possível guardar as cores.'));
    }
  };

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <h1 className="section-title">Aparência do back-office</h1>
          <p className="section-subtitle">
            Cores da barra do topo, do menu e do painel{shared ? ', para toda a equipa' : ''}. As alterações aparecem
            logo, para ver antes de gravar.
          </p>
        </div>
      </div>

      <div className="backoffice-body">
        {!shared && (
          <p className="backoffice-note">
            Por agora as cores ficam guardadas só neste browser. Passam a valer para toda a equipa quando a API com as
            cores do back-office estiver publicada.
          </p>
        )}

        <div className="aparencia">
          <form className="aparencia__form" onSubmit={submit} noValidate>
            <fieldset className="settings-card aparencia__cartao" disabled={saving}>
              <legend>Conjuntos prontos</legend>
              <div className="aparencia-conjuntos">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="aparencia-conjunto"
                    aria-pressed={sameTheme(draft, preset.theme)}
                    onClick={() => update(preset.theme)}
                  >
                    <span className="aparencia-conjunto__cores" aria-hidden="true">
                      {THEME_KEYS.map((key) => (
                        <span key={key} style={{ background: preset.theme[key] }} />
                      ))}
                    </span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="settings-card aparencia__cartao" disabled={saving}>
              <legend>Cores</legend>
              {THEME_KEYS.map((key) => {
                const field = THEME_FIELDS[key];
                const id = `aparencia-${key}`;
                return (
                  <div key={key} className="aparencia-cor">
                    <div className="aparencia-cor__nome">
                      <label htmlFor={id}>{field.label}</label>
                      <small id={`${id}-ajuda`}>{field.help}</small>
                    </div>
                    <div className="aparencia-cor__campos">
                      <input
                        type="color"
                        className="aparencia-cor__amostra"
                        value={draft[key]}
                        onChange={(event) => update({ ...draft, [key]: event.target.value })}
                        aria-label={`${field.label}: escolher no quadro de cores`}
                      />
                      <input
                        id={id}
                        type="text"
                        className="form-input aparencia-cor__hex"
                        value={texts[key]}
                        onChange={(event) => typeColor(key, event.target.value)}
                        onBlur={() => setTexts((current) => ({ ...current, [key]: draft[key] }))}
                        aria-describedby={`${id}-ajuda`}
                        aria-invalid={normalizeHex(texts[key]) === null}
                        maxLength={7}
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm aparencia-cor__original"
                        onClick={() => update({ ...draft, [key]: DEFAULT_THEME[key] })}
                        disabled={draft[key] === DEFAULT_THEME[key]}
                        title={`Voltar à cor original (${DEFAULT_THEME[key]})`}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        Original
                      </button>
                    </div>
                  </div>
                );
              })}
            </fieldset>

            {(problems.length > 0 || errors.length > 0) && (
              <div className="settings-errors" role="alert">
                {[...problems, ...errors].map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}

            <div className="settings-actions aparencia__accoes">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => update(DEFAULT_THEME)}
                disabled={saving || sameTheme(draft, DEFAULT_THEME)}
              >
                Repor as cores originais
              </button>
              <button type="button" className="btn btn-outline" onClick={() => update(initial)} disabled={saving || !changed}>
                Desfazer alterações
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !changed || problems.length > 0}>
                {saving ? 'A guardar…' : 'Guardar cores'}
              </button>
            </div>

            {updatedAt && (
              <p className="aparencia__alteracao">
                Última alteração: {formatDate(updatedAt)}
                {updatedBy ? ` por ${updatedBy}` : ''}.
              </p>
            )}
          </form>

          <aside className="aparencia__antevisao" aria-label="Pré-visualização">
            <p className="aparencia__antevisao-titulo">Pré-visualização</p>
            <div className="aparencia-mini" aria-hidden="true">
              <div className="aparencia-mini__topo">
                <span className="aparencia-mini__logo" />
                <span className="aparencia-mini__app" />
                <span className="aparencia-mini__procura" />
                <span className="aparencia-mini__avatar" />
              </div>
              <div className="aparencia-mini__corpo">
                <div className="aparencia-mini__menu">
                  <span className="aparencia-mini__rotulo" />
                  <span className="aparencia-mini__item aparencia-mini__item--activo" />
                  <span className="aparencia-mini__item" />
                  <span className="aparencia-mini__rotulo" />
                  <span className="aparencia-mini__item" />
                  <span className="aparencia-mini__item" />
                </div>
                <div className="aparencia-mini__conteudo">
                  <div className="aparencia-mini__faixa">
                    <span className="aparencia-mini__data" />
                    <span className="aparencia-mini__linhas">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <div className="aparencia-mini__cartoes">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
            <p className="aparencia__antevisao-nota">A faixa do Painel, com estas cores:</p>
            <div className="aparencia__faixa" aria-hidden="true">
              <BackofficeWelcome
                now={now}
                compact
                phrase="Indicadores de gestão e o trabalho do dia na loja Super7 Digital."
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
