import { useEffect } from 'react';

const SWIPE_THRESHOLD_PX = 50;
const MAX_VERTICAL_DRIFT_PX = 80;

export function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
): void {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent): void => {
      if (!tracking) {
        return;
      }
      tracking = false;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT_PX) {
        return;
      }
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
        return;
      }

      if (deltaX < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
}
