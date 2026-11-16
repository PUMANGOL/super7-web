import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/store/Icon';
import { NoticeContext, type NoticeAction } from './notice';

interface Notice {
  id: number;
  message: string;
  action?: NoticeAction;
}

const DURATION_MS = 4200;

/** Avisos da loja (classe `s7-aviso`): "Produto adicionado ao carrinho · Ver carrinho". */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const sequence = useRef(0);

  const notify = useCallback((message: string, action?: NoticeAction) => {
    sequence.current += 1;
    setNotice({ id: sequence.current, message, action });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div className="s7-avisos" role="status" aria-live="polite">
        {notice && (
          <div className="s7-aviso" key={notice.id}>
            <Icon name="check" />
            <p>{notice.message}</p>
            {notice.action && (
              <Link to={notice.action.to} onClick={() => setNotice(null)}>
                {notice.action.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}
