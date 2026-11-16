import { useEffect } from 'react';

const SUFFIX = 'Super7 Digital';

/** Define o título do separador: "Cabazes de Natal · Super7 Digital". */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}
