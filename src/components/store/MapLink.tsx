import { mapUrl, postCoordinates } from '../../catalog/maps';
import type { PickupPost } from '../../types/api';
import { Icon } from './Icon';

interface MapLinkProps {
  post: Pick<PickupPost, 'name' | 'latitude' | 'longitude'> | null | undefined;
  /** Texto ao lado do ícone ("Ver no mapa"); sem ele, só o ícone. */
  label?: string;
  className?: string;
}

/**
 * Ícone que abre o mapa (Google Maps, numa nova janela) na localização da loja definida no back-office. Sem
 * coordenadas não mostra nada.
 */
export function MapLink({ post, label, className }: MapLinkProps) {
  const url = mapUrl(postCoordinates(post));
  if (!url || !post) return null;
  const classes = ['s7-mapa', label ? 's7-mapa--texto' : '', className].filter(Boolean).join(' ');
  return (
    <a
      className={classes}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label ?? 'Ver no mapa'}: ${post.name} (abre numa nova janela)`}
      title={label ? undefined : `Ver ${post.name} no mapa`}
    >
      <Icon name="mapa" />
      {label && <span>{label}</span>}
    </a>
  );
}
