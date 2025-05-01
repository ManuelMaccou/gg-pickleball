interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the distance between two GPS points in meters.
 */
export function haversineDistance(pos1: LatLng, pos2: LatLng): number {
  const R = 6371e3; // Earth radius in meters
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

  const φ1 = toRadians(pos1.latitude);
  const φ2 = toRadians(pos2.latitude);
  const Δφ = toRadians(pos2.latitude - pos1.latitude);
  const Δλ = toRadians(pos2.longitude - pos1.longitude);

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
}
