import type { IconName } from '../../catalog/types';

interface IconProps {
  name: IconName;
  className?: string;
}

/** Ícone do sprite (`<IconSprite />` tem de estar na página). */
export function Icon({ name, className }: IconProps) {
  return (
    <svg className={className ? `s7-ico ${className}` : 's7-ico'} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** Sprite SVG partilhado pelos ícones da loja. Renderizado uma vez na raiz da aplicação. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-pesquisa" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></symbol>
        <symbol id="i-carrinho" viewBox="0 0 24 24"><path d="M3 4h2.3l2.2 11h10.3l2-8H6.5" /><circle cx="9.5" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></symbol>
        <symbol id="i-gift" viewBox="0 0 24 24"><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5.5 12v8.5h13V12M12 8v12.5" /><path d="M12 8S10.6 3.8 8 3.8a2.1 2.1 0 0 0 0 4.2h4Zm0 0s1.4-4.2 4-4.2a2.1 2.1 0 0 1 0 4.2h-4Z" /></symbol>
        <symbol id="i-tag" viewBox="0 0 24 24"><path d="M12.6 3.5H5A1.5 1.5 0 0 0 3.5 5v7.6c0 .4.16.78.44 1.06l6.9 6.9a1.5 1.5 0 0 0 2.12 0l7.6-7.6a1.5 1.5 0 0 0 0-2.12l-6.9-6.9a1.5 1.5 0 0 0-1.06-.44Z" /><circle cx="8" cy="8" r="1.2" /></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></symbol>
        <symbol id="i-camiao" viewBox="0 0 24 24"><path d="M2.5 6.5h11v9h-11zM13.5 10h4l3 3v2.5h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></symbol>
        <symbol id="i-relogio" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></symbol>
        <symbol id="i-seta" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
        <symbol id="i-seta-esq" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></symbol>
        <symbol id="i-menos" viewBox="0 0 24 24"><path d="M6 12h12" /></symbol>
        <symbol id="i-mais" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" /></symbol>
        <symbol id="i-lixo" viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></symbol>
        <symbol id="i-filtro" viewBox="0 0 24 24"><path d="M4 6.5h16M7 12h10M10 17.5h4" /></symbol>
        <symbol id="i-telemovel" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></symbol>
        <symbol id="i-escudo" viewBox="0 0 24 24"><path d="M12 3 5 5.5v6c0 4.5 3 7.7 7 9.5 4-1.8 7-5 7-9.5v-6L12 3Z" /><path d="m9 12 2.2 2.2L15 10.4" /></symbol>
        <symbol id="i-box" viewBox="0 0 24 24"><path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4v-9Z" /><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9" /></symbol>
        <symbol id="i-bottle" viewBox="0 0 24 24"><path d="M10 2.5h4v3l1.5 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20V9L10 5.5v-3Z" /><path d="M8.5 13h7" /></symbol>
        <symbol id="i-basket" viewBox="0 0 24 24"><path d="M3.5 10h17l-1.6 9.5H5.1L3.5 10Z" /><path d="m8 10 3-6M16 10l-3-6M9 13.5v3M12 13.5v3M15 13.5v3" /></symbol>
        <symbol id="i-cookie" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="9.5" r=".9" /><circle cx="14.5" cy="8.5" r=".9" /><circle cx="14.5" cy="14" r=".9" /><circle cx="9.5" cy="15" r=".9" /></symbol>
        <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="M11 3.5 12.8 9l5.7 1.8-5.7 1.8L11 18l-1.8-5.4-5.7-1.8L9.2 9 11 3.5Z" /><path d="M18.5 15.5v5M16 18h5" /></symbol>
        <symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></symbol>
        <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" /><path d="M12 6.5v13" /></symbol>
        <symbol id="i-recibo" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5v-17Z" /><path d="M9 8.5h6M9 12.5h6" /></symbol>
        <symbol id="i-loja" viewBox="0 0 24 24"><path d="M4 9.5 5.5 4h13L20 9.5M4.5 10v10h15V10" /><path d="M4 9.5a2.7 2.7 0 0 0 5.33 0 2.7 2.7 0 0 0 5.34 0 2.7 2.7 0 0 0 5.33 0M9.5 20v-5.5h5V20" /></symbol>
        <symbol id="i-cartao" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></symbol>
        <symbol id="i-dinheiro" viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="19" height="11" rx="1.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></symbol>
        <symbol id="i-equipa" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9.5" r="2.3" /><path d="M16.5 14.2c2.4.2 4 1.9 4 4.3" /></symbol>
        <symbol id="i-alerta" viewBox="0 0 24 24"><path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></symbol>
      </defs>
    </svg>
  );
}
