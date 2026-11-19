import { useEffect, useRef, useState, type RefObject } from 'react';

const REDUZIR = '(prefers-reduced-motion: reduce)';
const RATO = '(hover: hover) and (pointer: fine)';

const limitar = (valor: number) => Math.min(1, Math.max(0, valor));

/**
 * Movimento do hero de Natal (as regras visuais estão em super7-hero.css):
 * - a cena dos cabazes roda com o rato; sem rato, ou em toque, oscila sozinha;
 * - ao descer a página a cena inclina-se e o texto sobe e desvanece (`--s7h-sp`, de 0 a 1);
 * - com rato, um foco de luz segue o cursor (`--s7h-mx/--s7h-my`) e os botões são "magnéticos".
 * Só corre enquanto o hero está no ecrã. Com "reduzir movimento" não faz nada.
 */
export function useHeroMotion(heroRef: RefObject<HTMLElement | null>, sceneRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const hero = heroRef.current;
    const scene = sceneRef.current;
    if (!hero || !scene || window.matchMedia(REDUZIR).matches) return;
    const rato = window.matchMedia(RATO).matches;

    let alvoX = 0;
    let alvoY = 0;
    let x = 0;
    let y = 0;
    let ultimoMovimento = Number.NEGATIVE_INFINITY;
    let ultimoSp = -1;
    let visivel = false;
    let frame = 0;
    let iman: HTMLElement | null = null;

    const soltarIman = () => {
      if (!iman) return;
      iman.style.removeProperty('--s7h-bx');
      iman.style.removeProperty('--s7h-by');
      iman = null;
    };

    const aoMover = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const caixa = hero.getBoundingClientRect();
      alvoX = (event.clientX - caixa.left) / caixa.width - 0.5;
      alvoY = (event.clientY - caixa.top) / caixa.height - 0.5;
      ultimoMovimento = performance.now();
      if (!rato) return;

      hero.style.setProperty('--s7h-mx', `${Math.round(event.clientX - caixa.left)}px`);
      hero.style.setProperty('--s7h-my', `${Math.round(event.clientY - caixa.top)}px`);

      const botao = (event.target as Element | null)?.closest<HTMLElement>('.s7-hero__accoes .s7-btn') ?? null;
      if (botao !== iman) soltarIman();
      if (!botao) return;
      iman = botao;
      const b = botao.getBoundingClientRect();
      botao.style.setProperty('--s7h-bx', `${((event.clientX - b.left - b.width / 2) * 0.25).toFixed(1)}px`);
      botao.style.setProperty('--s7h-by', `${((event.clientY - b.top - b.height / 2) * 0.4).toFixed(1)}px`);
    };

    const aoSair = () => {
      ultimoMovimento = Number.NEGATIVE_INFINITY;
      soltarIman();
    };

    const passo = (t: number) => {
      if (!visivel) {
        frame = 0;
        return;
      }
      // Progresso do scroll: 0 no topo, 1 quando o fundo do hero sai do ecrã.
      const caixa = hero.getBoundingClientRect();
      const sp = limitar(window.scrollY / Math.max(1, caixa.top + window.scrollY + caixa.height));

      // Parado há 2,5 s: a cena balança devagar sozinha.
      const parado = t - ultimoMovimento > 2500;
      const destinoX = parado ? Math.sin(t / 1900) * 0.2 : alvoX;
      const destinoY = parado ? Math.cos(t / 2300) * 0.16 : alvoY;
      x += (destinoX - x) * 0.06;
      y += (destinoY - y) * 0.06;

      scene.style.setProperty('--s7h-rx', (x * 16).toFixed(3)); // rotateY: até ±8°
      scene.style.setProperty('--s7h-ry', (-y * 12 + sp * 16).toFixed(3)); // rotateX: até ±6°, mais a inclinação do scroll
      if (Math.abs(sp - ultimoSp) > 0.0005) {
        hero.style.setProperty('--s7h-sp', sp.toFixed(4));
        ultimoSp = sp;
      }
      frame = requestAnimationFrame(passo);
    };

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      if (visivel && !frame) frame = requestAnimationFrame(passo);
    });
    observador.observe(hero);
    hero.addEventListener('pointermove', aoMover);
    hero.addEventListener('pointerleave', aoSair);

    return () => {
      observador.disconnect();
      hero.removeEventListener('pointermove', aoMover);
      hero.removeEventListener('pointerleave', aoSair);
      cancelAnimationFrame(frame);
      soltarIman();
    };
  }, [heroRef, sceneRef]);
}

/** Número que conta de 0 (ou do valor anterior) até `alvo`, com uma espera inicial. */
export function useContagemAte(alvo: number, esperaMs = 1000, duracaoMs = 1100): number {
  const [reduzir] = useState(() => window.matchMedia(REDUZIR).matches);
  const [valor, setValor] = useState(0);
  const ultimo = useRef(0);

  useEffect(() => {
    if (reduzir) return;
    const partida = ultimo.current;
    let frame = 0;
    let inicio: number | null = null;
    const passo = (t: number) => {
      inicio ??= t + esperaMs;
      const k = limitar((t - inicio) / duracaoMs);
      const suave = 1 - (1 - k) ** 3;
      // Em centenas enquanto conta, o valor exacto no fim.
      const n = k >= 1 ? alvo : Math.round((partida + (alvo - partida) * suave) / 100) * 100;
      ultimo.current = n;
      setValor(n);
      if (k < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [alvo, esperaMs, duracaoMs, reduzir]);

  return reduzir ? alvo : valor;
}
