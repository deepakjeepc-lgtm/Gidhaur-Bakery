import React from 'react';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = () => {
  // Completely disabled: Location permission is never requested or required
  return null;
};
