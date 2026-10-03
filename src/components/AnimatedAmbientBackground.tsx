import React from 'react';

interface AnimatedAmbientBackgroundProps {
  isDiwaliActive?: boolean;
}

/**
 * Ultra-lightweight static background.
 * Zero CPU / GPU overhead during scroll to ensure 60fps/120fps buttery smooth performance.
 */
export const AnimatedAmbientBackground: React.FC<AnimatedAmbientBackgroundProps> = React.memo(({
  isDiwaliActive = false,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 select-none ${
        isDiwaliActive ? 'bg-[#fcf8f0]' : 'bg-white'
      }`}
    />
  );
});
