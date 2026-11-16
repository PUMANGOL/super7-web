import { useState } from 'react';
import { sizedImageUrl } from '../../api/images';
import './Thumbnail.css';

interface ThumbnailProps {
  title: string;
  src?: string | null;
  className?: string;
  /** Caixa pedida à API de imagens, em píxeis. */
  size?: number;
}

/** Miniatura de produto ou livro; sem imagem, mostra a inicial do nome. */
export function Thumbnail({ title, src, className = '', size = 120 }: ThumbnailProps) {
  const url = sizedImageUrl(src, size);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showFallback = !url || failedUrl === url;

  return (
    <div className={['thumb', showFallback && 'thumb--fallback', className].filter(Boolean).join(' ')}>
      {showFallback ? (
        <span className="thumb-initial" aria-hidden="true">
          {title.trim().charAt(0).toUpperCase() || '?'}
        </span>
      ) : (
        <img src={url} alt="" className="thumb__img" loading="lazy" onError={() => setFailedUrl(url)} />
      )}
    </div>
  );
}
