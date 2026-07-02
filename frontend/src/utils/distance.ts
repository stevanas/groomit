// Haversine distance in kilometers between two coordinates.
export function distanceKm(
  a: { latitude: number; longitude: number },
  lat?: number | null,
  lng?: number | null,
): number | null {
  if (lat == null || lng == null) return null;
  const R = 6371;
  const dLat = ((lat - a.latitude) * Math.PI) / 180;
  const dLng = ((lng - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Human label: meters under 1 km, else km (1 decimal below 10 km).
export function formatDistance(km: number | null | undefined, unitKm: string, unitM: string): string | null {
  if (km == null || isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} ${unitM}`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ${unitKm}`;
}
