import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

type DropdownDirection = 'up' | 'down';

interface AdaptiveDropdownOptions {
  open: boolean;
  preferredMaxHeight?: number;
  viewportPadding?: number;
  gap?: number;
  allowUpward?: boolean;
}

interface AdaptiveDropdownState {
  direction: DropdownDirection;
  style: CSSProperties;
}

function readSafeAreaInset(name: '--app-safe-area-top' | '--app-safe-area-bottom') {
  if (typeof window === 'undefined') {
    return 0;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useAdaptiveDropdownPosition(
  anchorRef: RefObject<HTMLElement | null>,
  {
    open,
    preferredMaxHeight = 320,
    viewportPadding = 8,
    gap = 8,
    allowUpward = true,
  }: AdaptiveDropdownOptions
): AdaptiveDropdownState {
  const [state, setState] = useState<AdaptiveDropdownState>({
    direction: 'down',
    style: {
      top: `calc(100% + ${gap}px)`,
      maxHeight: preferredMaxHeight,
    },
  });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    let recheckTimer: ReturnType<typeof setTimeout> | null = null;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const safeTop = readSafeAreaInset('--app-safe-area-top');
      const safeBottom = readSafeAreaInset('--app-safe-area-bottom');
      const topBoundary = viewportPadding + safeTop;
      const bottomBoundary = viewportHeight - viewportPadding - safeBottom;
      const spaceAbove = Math.max(0, rect.top - topBoundary - gap);
      const spaceBelow = Math.max(0, bottomBoundary - rect.bottom - gap);
      const minimumUsableBelowSpace = Math.min(preferredMaxHeight, 140);
      const openUpward =
        allowUpward && spaceBelow < minimumUsableBelowSpace && spaceAbove > spaceBelow + 48;
      const availableSpace = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(0, Math.min(preferredMaxHeight, availableSpace));

      setState({
        direction: openUpward ? 'up' : 'down',
        style: openUpward
          ? {
              bottom: `calc(100% + ${gap}px)`,
              maxHeight,
            }
          : {
              top: `calc(100% + ${gap}px)`,
              maxHeight,
            },
      });
    }

    updatePosition();
    recheckTimer = setTimeout(updatePosition, 420);

    const viewport = window.visualViewport;

    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    viewport?.addEventListener('resize', updatePosition);
    viewport?.addEventListener('scroll', updatePosition);

    return () => {
      if (recheckTimer) {
        clearTimeout(recheckTimer);
      }
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      viewport?.removeEventListener('resize', updatePosition);
      viewport?.removeEventListener('scroll', updatePosition);
    };
  }, [allowUpward, anchorRef, gap, open, preferredMaxHeight, viewportPadding]);

  return state;
}