import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { RestaurantSettings } from '../types';
import { subscribeToRestaurantSettings, getLocalRestaurantSettings } from '../services/staffService';
import { applyWebsiteBrandingToDocument } from '../utils/branding';

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'requesting' | 'unsupported';

interface UserLocation {
  lat: number;
  lng: number;
}

interface LocationContextType {
  userLocation: UserLocation | null;
  locationStatus: LocationPermissionStatus;
  distanceKm: number | null;
  deliveryFee: number;
  feeTierText: string;
  isFreeDelivery: boolean;
  settings: RestaurantSettings;
  requestLocation: () => Promise<boolean>;
  showPermissionGuide: boolean;
  setShowPermissionGuide: (show: boolean) => void;
  errorMessage: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<RestaurantSettings>(() => getLocalRestaurantSettings());

  // Subscribe to live restaurant settings and sync document branding
  useEffect(() => {
    applyWebsiteBrandingToDocument(settings);
    const unsubscribe = subscribeToRestaurantSettings((newSettings) => {
      setSettings(newSettings);
      applyWebsiteBrandingToDocument(newSettings);
    });
    return () => unsubscribe();
  }, []);

  // Safe mock requestLocation that never asks browser permission or prompts user
  const requestLocation = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const setShowPermissionGuide = useCallback((_show: boolean) => {
    // Disabled: never show permission guide
  }, []);

  return (
    <LocationContext.Provider
      value={{
        userLocation: null,
        locationStatus: 'granted',
        distanceKm: null,
        deliveryFee: 0,
        feeTierText: '0–5 km Free Delivery',
        isFreeDelivery: true,
        settings,
        requestLocation,
        showPermissionGuide: false,
        setShowPermissionGuide,
        errorMessage: null,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
