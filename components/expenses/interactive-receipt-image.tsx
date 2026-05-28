'use client';

import { PointerEvent, WheelEvent, useRef, useState } from 'react';

import { CircleHelpIcon, MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type InteractiveReceiptImageProps = {
  src: string;
  alt: string;
  locale: 'en' | 'fr';
  maxScale?: number;
  doubleTapScale?: number;
  className?: string;
  imageClassName?: string;
  onImageError?: () => void;
};

type Point = { x: number; y: number };

type PinchState = {
  distance: number;
  midpoint: Point;
  scale: number;
  offset: Point;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function InteractiveReceiptImage({
  src,
  alt,
  locale,
  maxScale = 4,
  doubleTapScale = 2.5,
  className,
  imageClassName,
  onImageError,
}: InteractiveReceiptImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchStateRef = useRef<PinchState | null>(null);
  const panStartPointRef = useRef<Point | null>(null);
  const panStartOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lastTapAtRef = useRef(0);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  const transformRef = useRef<{ scale: number; offset: Point }>({
    scale: 1,
    offset: { x: 0, y: 0 },
  });

  const t = {
    en: {
      hint: 'Pinch or double tap to zoom. Drag to inspect details.',
      hintLabel: 'Zoom help',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      reset: 'Reset zoom',
    },
    fr: {
      hint: 'Pincez ou double-tapez pour zoomer. Glissez pour inspecter les details.',
      hintLabel: 'Aide zoom',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arriere',
      reset: 'Reinitialiser le zoom',
    },
  }[locale];

  function clampOffset(candidate: Point, nextScale: number): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return candidate;
    }

    const maxX = Math.max(0, (rect.width * (nextScale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (nextScale - 1)) / 2);

    return {
      x: clamp(candidate.x, -maxX, maxX),
      y: clamp(candidate.y, -maxY, maxY),
    };
  }

  function commitTransform(nextScale: number, nextOffset: Point) {
    const clampedScale = clamp(nextScale, 1, maxScale);
    const clampedOffset = clampedScale <= 1 ? { x: 0, y: 0 } : clampOffset(nextOffset, clampedScale);

    transformRef.current = {
      scale: clampedScale,
      offset: clampedOffset,
    };

    setScale(clampedScale);
    setOffset(clampedOffset);
  }

  function zoomTo(nextScale: number, clientX?: number, clientY?: number) {
    const current = transformRef.current;
    const targetScale = clamp(nextScale, 1, maxScale);

    if (targetScale <= 1) {
      commitTransform(1, { x: 0, y: 0 });
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || clientX === undefined || clientY === undefined) {
      commitTransform(targetScale, current.offset);
      return;
    }

    const pointX = clientX - rect.left - rect.width / 2;
    const pointY = clientY - rect.top - rect.height / 2;

    const sourceScale = current.scale <= 0 ? 1 : current.scale;
    const imageX = (pointX - current.offset.x) / sourceScale;
    const imageY = (pointY - current.offset.y) / sourceScale;

    const rawOffset = {
      x: pointX - imageX * targetScale,
      y: pointY - imageY * targetScale,
    };

    commitTransform(targetScale, rawOffset);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());
    const current = transformRef.current;

    if (points.length === 1) {
      panStartPointRef.current = points[0];
      panStartOffsetRef.current = current.offset;
      return;
    }

    if (points.length === 2) {
      pinchStateRef.current = {
        distance: distance(points[0], points[1]),
        midpoint: midpoint(points[0], points[1]),
        scale: current.scale,
        offset: current.offset,
      };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());

    if (points.length === 2 && pinchStateRef.current) {
      const pinch = pinchStateRef.current;
      const nextDistance = distance(points[0], points[1]);
      const ratio = pinch.distance > 0 ? nextDistance / pinch.distance : 1;
      const nextScale = clamp(pinch.scale * ratio, 1, maxScale);
      const nextMidpoint = midpoint(points[0], points[1]);

      const rawOffset = {
        x: pinch.offset.x + (nextMidpoint.x - pinch.midpoint.x),
        y: pinch.offset.y + (nextMidpoint.y - pinch.midpoint.y),
      };

      commitTransform(nextScale, rawOffset);
      return;
    }

    if (points.length !== 1) {
      return;
    }

    const current = transformRef.current;
    if (current.scale <= 1) {
      return;
    }

    const panStartPoint = panStartPointRef.current;
    if (!panStartPoint) {
      return;
    }

    const rawOffset = {
      x: panStartOffsetRef.current.x + (event.clientX - panStartPoint.x),
      y: panStartOffsetRef.current.y + (event.clientY - panStartPoint.y),
    };

    commitTransform(current.scale, rawOffset);
  }

  function finalizePointer(
    pointerId: number,
    pointerType: string,
    clientX: number,
    clientY: number
  ) {
    if (!pointersRef.current.has(pointerId)) {
      return;
    }

    pointersRef.current.delete(pointerId);

    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) {
      pinchStateRef.current = null;
    }

    if (points.length === 1) {
      panStartPointRef.current = points[0];
      panStartOffsetRef.current = transformRef.current.offset;
    } else {
      panStartPointRef.current = null;
    }

    if (points.length === 0) {
      setIsInteracting(false);
    }

    if (pointerType === 'touch') {
      const now = Date.now();
      if (now - lastTapAtRef.current < 280) {
        const target = transformRef.current.scale > 1.4 ? 1 : doubleTapScale;
        zoomTo(target, clientX, clientY);
        lastTapAtRef.current = 0;
      } else {
        lastTapAtRef.current = now;
      }
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    finalizePointer(event.pointerId, event.pointerType, event.clientX, event.clientY);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    finalizePointer(event.pointerId, event.pointerType, event.clientX, event.clientY);
  }

  function handleDoubleClick(event: PointerEvent<HTMLDivElement>) {
    const target = transformRef.current.scale > 1.4 ? 1 : doubleTapScale;
    zoomTo(target, event.clientX, event.clientY);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    const step = direction < 0 ? 0.25 : -0.25;
    zoomTo(transformRef.current.scale + step, event.clientX, event.clientY);
  }

  const canPan = scale > 1;
  const zoomPercent = `${Math.round(scale * 100)}%`;

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg border border-border/70 bg-linear-to-br from-muted/15 via-background to-muted/5',
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn('relative h-full w-full touch-none select-none', canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={onImageError}
          className={cn('h-full w-full object-contain will-change-transform', imageClassName)}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isInteracting ? 'none' : 'transform 160ms ease-out',
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end gap-2 bg-linear-to-b from-background/90 via-background/35 to-transparent px-2 py-2">
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/90 px-1 py-1 shadow-sm backdrop-blur">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={t.hintLabel}
                  aria-label={t.hintLabel}
                >
                  <CircleHelpIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-56 text-xs leading-relaxed">
                {t.hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="px-1 text-[10px] font-medium text-muted-foreground sm:text-xs">{zoomPercent}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => zoomTo(transformRef.current.scale - 0.25)}
            disabled={!canPan}
            title={t.zoomOut}
            aria-label={t.zoomOut}
          >
            <MinusIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => zoomTo(transformRef.current.scale + 0.25)}
            title={t.zoomIn}
            aria-label={t.zoomIn}
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => zoomTo(1)}
            disabled={!canPan}
            title={t.reset}
            aria-label={t.reset}
          >
            <RotateCcwIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
