import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

interface SwipeToDeliverProps {
  onConfirm: () => void;
  isLoading?: boolean;
  amount: number;
  label?: string;
  disabled?: boolean;
}

export const SwipeToDeliver: React.FC<SwipeToDeliverProps> = ({
  onConfirm,
  isLoading = false,
  amount,
  label,
  disabled = false
}) => {
  const [sliderPosition, setSliderPosition] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);
  const startXRef = useRef<number>(0);
  const currentPosRef = useRef<number>(0);

  const HANDLE_SIZE = 48; // 48px circle
  const PADDING = 4; // 4px padding on all sides
  const maxDrag = Math.max(1, containerWidth - HANDLE_SIZE - PADDING * 2);

  // Measure container width accurately on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleDragStart = (clientX: number) => {
    if (disabled || isLoading || isCompleted) return;
    setIsDragging(true);
    startXRef.current = clientX;
    currentPosRef.current = sliderPosition;
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || disabled || isLoading || isCompleted) return;
    if (maxDrag <= 0) return;

    const deltaX = clientX - startXRef.current;
    const newProgress = Math.max(0, Math.min(1, deltaX / maxDrag));
    setSliderPosition(newProgress);
  }, [isDragging, disabled, isLoading, isCompleted, maxDrag]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || disabled || isLoading || isCompleted) return;
    setIsDragging(false);

    // If dragged more than 78%, trigger confirmation
    if (sliderPosition >= 0.78) {
      setSliderPosition(1);
      setIsCompleted(true);
      onConfirm();
    } else {
      // Spring back to 0 smoothly
      setSliderPosition(0);
    }
  }, [isDragging, sliderPosition, disabled, isLoading, isCompleted, onConfirm]);

  // Touch event handlers
  const onTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    handleDragEnd();
  };

  // Global mouse handlers for smooth drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX);
    };
    const onMouseUp = () => {
      handleDragEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Reset completion state if amount or loading changes back
  useEffect(() => {
    if (!isLoading && !disabled) {
      setIsCompleted(false);
      setSliderPosition(0);
    }
  }, [amount]);

  const currentTranslateX = sliderPosition * maxDrag;
  // The green fill expands seamlessly from 0 to the right edge of the handle
  const currentFillWidth = isCompleted
    ? containerWidth
    : sliderPosition === 0
    ? HANDLE_SIZE + PADDING * 2
    : currentTranslateX + HANDLE_SIZE + PADDING * 2;

  return (
    <div className="w-full select-none" id="swipe-to-deliver-capsule-wrapper">
      {/* Outer Capsule Container */}
      <div
        ref={containerRef}
        className={`relative w-full h-14 bg-slate-950 rounded-full p-1 overflow-hidden transition-all shadow-inner border border-slate-800 flex items-center ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
        }`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={(e) => handleDragStart(e.clientX)}
      >
        {/* Seamless Animated Emerald Progress Fill Track */}
        <div
          className={`absolute left-0 top-0 bottom-0 bg-emerald-600 rounded-full transition-all ${
            isDragging ? 'duration-0' : 'duration-200 ease-out'
          }`}
          style={{
            width: `${Math.min(containerWidth, currentFillWidth)}px`,
            opacity: sliderPosition === 0 ? 0.85 : 1
          }}
        />

        {/* Center Prompt Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14 text-center z-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wide">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              <span>Completing Delivery...</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Delivered & Paid (₹{amount})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-white/95 font-bold text-xs tracking-tight">
              <span className="truncate">
                {label || `Slide to Deliver (₹${amount})`}
              </span>
              <div className="flex items-center text-white/60 animate-pulse">
                <ChevronRight className="w-3.5 h-3.5 -mr-1.5" />
                <ChevronRight className="w-3.5 h-3.5 -mr-1.5" />
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}
        </div>

        {/* Draggable Circular Capsule Thumb / Handle - Exactly Centered */}
        <div
          className={`absolute left-1 top-1/2 w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center z-10 border border-slate-200/90 ${
            isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'
          }`}
          style={{
            transform: `translate3d(${currentTranslateX}px, -50%, 0)`
          }}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-slate-800 animate-spin" />
          ) : isCompleted || sliderPosition >= 0.78 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <div className="flex items-center justify-center text-slate-900">
              <ChevronRight className="w-5 h-5 text-slate-900 font-extrabold stroke-[2.5]" />
            </div>
          )}
        </div>
      </div>

      <div className="text-center mt-1.5">
        <span className="text-[11px] text-slate-400 font-medium">
          Slide circle completely to right to confirm delivery
        </span>
      </div>
    </div>
  );
};
