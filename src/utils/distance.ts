import { RestaurantSettings } from '../types';

/**
 * Utility functions for calculating real-time distance and formatting it in Meters/KM.
 */

// Calculate direct Haversine distance in meters between two GPS coordinates
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate direct Haversine distance in kilometers
export function calculateDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const meters = calculateDistanceInMeters(lat1, lon1, lat2, lon2);
  return meters / 1000;
}

// Format meters into simple human-readable distance for customers & riders
export function formatDistanceAway(meters: number): string {
  if (isNaN(meters) || meters < 0) return 'Rider on the way';
  
  // Within doorstep / close proximity
  if (meters <= 250) {
    return 'At your doorstep 😋';
  }
  
  // Under 2 km (Local neighborhood delivery)
  if (meters < 2000) {
    return 'Arriving shortly (Nearby)';
  }
  
  const km = (meters / 1000).toFixed(1);
  return `On the way (~${km} km away)`;
}

/**
 * Calculate dynamic delivery fee based on distance:
 * - If location is NOT enabled / off / unavailable => ₹0 (Free Delivery)
 * - If location is enabled:
 *     - 0 to 5 km => ₹0 (Free Delivery)
 *     - > 5 km (any distance) => Flat ₹20
 */
export function calculateDeliveryFeeFromDistance(
  distanceKm: number | null | undefined,
  settings?: RestaurantSettings
): {
  fee: number;
  distanceKm: number | null;
  tierText: string;
  isFree: boolean;
} {
  // If location not enabled / null / NaN => ₹0 (Free Delivery)
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm) || distanceKm <= 0) {
    return {
      fee: 0,
      distanceKm: null,
      tierText: 'Free Delivery',
      isFree: true,
    };
  }

  const freeRadius = settings?.freeDeliveryRadiusKm ?? 5;

  // Under or equal to 5 km => Free Delivery
  if (distanceKm <= freeRadius) {
    return {
      fee: 0,
      distanceKm,
      tierText: 'Free Delivery (0–5 km)',
      isFree: true,
    };
  }

  // Beyond 5 km => Flat ₹20 delivery fee
  return {
    fee: 20,
    distanceKm,
    tierText: 'Delivery Fee (> 5 km)',
    isFree: false,
  };
}
