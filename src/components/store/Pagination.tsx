import { pageWindow } from '../../catalog/query';

interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pages, onChange }: PaginationProps) {
  if (pages <= 1) return null;

  return (
    <nav className="s7-paginacao" aria-label="Páginas de resultados">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      {pageWindow(page, pages).map((number, index) =>
        number === null ? (
          <span key={`gap-${index}`} className="s7-paginacao__reticencias" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={number}
            type="button"
            aria-label={`Página ${number}`}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Seguinte
      </button>
    </nav>
  );
}
