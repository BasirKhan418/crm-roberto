'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
}

function getCanvasHeight(): number {
  if (typeof window === 'undefined') {
    return 220;
  }

  return window.matchMedia('(max-width: 640px)').matches ? 180 : 220;
}

function applyCtxStyles(ctx: CanvasRenderingContext2D, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgb(17, 24, 39)';
  ctx.lineWidth = 2;
}

export default function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const canvasHeightRef = useRef(getCanvasHeight());
  const hasStrokeRef = useRef(false);
  const onSignatureChangeRef = useRef(onSignatureChange);
  const [hasStroke, setHasStroke] = useState(false);

  // Keep callback ref in sync so closures never go stale
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);

  // Sync the ref whenever React state changes (for resize snapshot logic)
  useEffect(() => {
    hasStrokeRef.current = hasStroke;
  }, [hasStroke]);

  const emitSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) {
      onSignatureChangeRef.current(null);
      return;
    }

    onSignatureChangeRef.current(canvas.toDataURL('image/png'));
  }, []);

  const resizeCanvas = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(Math.floor(rect.width), 1);
    const displayHeight = canvasHeightRef.current;

    // Snapshot existing drawing before resizing (resize clears the canvas)
    const snapshot = hasStrokeRef.current ? canvas.toDataURL('image/png') : null;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    applyCtxStyles(ctx, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (snapshot) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, displayWidth, displayHeight);
        // Re-apply styles after drawImage so subsequent strokes render correctly
        applyCtxStyles(ctx, dpr);
      };
      image.src = snapshot;
    }
  }, []);

  // Respond to viewport breakpoint changes
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    canvasHeightRef.current = media.matches ? 180 : 220;
    resizeCanvas();

    const listener = (event: MediaQueryListEvent) => {
      canvasHeightRef.current = event.matches ? 180 : 220;
      resizeCanvas();
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [resizeCanvas]);

  // Respond to container size changes
  useEffect(() => {
    resizeCanvas();

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const getCoordinates = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    isDrawingRef.current = true;

    const { x, y } = getCoordinates(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCoordinates]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    event.preventDefault();
    const { x, y } = getCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasStroke(true);
    }
  }, [getCoordinates]);

  const finishDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (pointerIdRef.current === event.pointerId) {
      event.preventDefault();
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      pointerIdRef.current = null;
      isDrawingRef.current = false;
      emitSignature();
    }
  }, [emitSignature]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyCtxStyles(ctx, dpr);
    hasStrokeRef.current = false;
    setHasStroke(false);
    onSignatureChangeRef.current(null);
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={wrapperRef}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
        style={{ touchAction: 'none' }}
      >
        {!hasStroke ? (
          <span className="pointer-events-none absolute left-4 top-4 text-xs font-medium text-slate-400">
            Draw your signature here
          </span>
        ) : null}

        <canvas
          ref={canvasRef}
          className="block w-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
          onPointerCancel={finishDrawing}
          aria-label="Signature canvas"
        />
      </div>

      <button
        type="button"
        onClick={clearSignature}
        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        Clear and start again
      </button>
    </div>
  );
}