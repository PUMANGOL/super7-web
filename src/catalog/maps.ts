import type { PickupPostDetails } from '../types/api';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';

/**
 * Coordenadas coladas no back-office: "-8.901612, 13.203219", "-8.901612 13.203219" ou um link do Google Maps com
 * coordenadas (".../@-8.9016,13.2032,17z", "?q=-8.9016,13.2032", "!3d-8.9016!4d13.2032"). Os links curtos
 * (maps.app.goo.gl) não trazem coordenadas: devolve null.
 */
export function parseCoordinates(text: string): Coordinates | null {
  const value = text.trim();
  if (!value) return null;
  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
    new RegExp(`@${NUMBER},\\s*${NUMBER}`),
    new RegExp(`[?&](?:q|query|ll|center|destination)=${NUMBER}(?:,|%2C)\\s*${NUMBER}`, 'i'),
    new RegExp(`(?:^|[^\\d.])(-?\\d{1,2}\\.\\d{3,})\\s*[,;\\s]\\s*(-?\\d{1,3}\\.\\d{3,})`),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
  }
  return null;
}

/** Coordenadas da loja, se estiverem definidas no back-office. */
export function postCoordinates(post: PickupPostDetails | null | undefined): Coordinates | null {
  if (post?.latitude == null || post.longitude == null) return null;
  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/** "-8.901612, 13.203219" (como se cola no Google Maps). */
export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${Number(latitude.toFixed(6))}, ${Number(longitude.toFixed(6))}`;
}

/** Abre o Google Maps no ponto (no telemóvel, a aplicação de mapas). */
export function mapUrl(coordinates: Coordinates | null): string | null {
  if (!coordinates) return null;
  return `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
}
