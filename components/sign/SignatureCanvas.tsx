'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(max-width: 640px)').matches;
}

export default function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const canvasHeightRef = useRef(isMobileViewport() ? 160 : 200);
  const [hasStroke, setHasStroke] = useState(false);

  const emitSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onSignatureChange(null);
      return;
    }

    if (!hasStroke) {
      onSignatureChange(null);
      return;
    }

    onSignatureChange(canvas.toDataURL('image/png'));
  }, [hasStroke, onSignatureChange]);

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

    const snapshot = hasStroke ? canvas.toDataURL('image/png') : null;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgb(17, 24, 39)';
    ctx.lineWidth = 2;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (snapshot) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, displayWidth, displayHeight);
      };
      image.src = snapshot;
    }
  }, [hasStroke]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    canvasHeightRef.current = media.matches ? 160 : 200;
    resizeCanvas();

    const listener = (event: MediaQueryListEvent) => {
      canvasHeightRef.current = event.matches ? 160 : 200;
      resizeCanvas();
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [resizeCanvas]);

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
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
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

    if (!hasStroke) {
      setHasStroke(true);
    }
  }, [getCoordinates, hasStroke]);

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="relative overflow-hidden rounded-md border"
        style={{
          border: '1.5px dashed var(--color-border-secondary)',
          background: 'var(--color-background-secondary)',
          touchAction: 'none',
        }}
      >
        {!hasStroke ? (
          <span className="pointer-events-none absolute left-3 top-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Sign here
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
        className="inline-flex items-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Clear signature
      </button>
    </div>
  );
}
