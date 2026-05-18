import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, SwitchCamera, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

function playScanBeep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 920;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
    osc.onended = (): void => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    /* sessiz başarısızlık */
  }
}

export function BarcodeScanner({
  onScan,
  onClose,
  isOpen,
}: Props): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastEmitRef = useRef<{ code: string; at: number } | null>(null);
  const [facingBack, setFacingBack] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const emit = useCallback(
    (code: string): void => {
      const trimmed = code.trim();
      if (trimmed.length === 0) {
        return;
      }
      const now = Date.now();
      const prev = lastEmitRef.current;
      if (prev && prev.code === trimmed && now - prev.at < 2000) {
        return;
      }
      lastEmitRef.current = { code: trimmed, at: now };
      playScanBeep();
      onScan(trimmed);
    },
    [onScan],
  );

  useEffect(() => {
    if (!isOpen) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setCameraError(null);

    void (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingBack
              ? { ideal: 'environment' }
              : { ideal: 'user' },
          },
          audio: false,
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoEl,
          (result, err) => {
            if (cancelled) {
              return;
            }
            if (err && !(err instanceof Error && err.name === 'NotFoundException')) {
              return;
            }
            if (result) {
              emit(result.getText());
            }
          },
        );
        if (!cancelled) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'Kamera açılamadı. HTTPS veya localhost kullandığınızdan ve tarayıcı izninin verildiğinden emin olun.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isOpen, facingBack, emit]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" aria-hidden />
            Barkod tarayıcı
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          <video
            ref={videoRef}
            className="size-full object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-3 rounded border border-white/30" />
          <div className="animate-barcode-scan-line pointer-events-none absolute left-[10%] right-[10%] top-[6%] h-0.5 bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
        </div>

        {cameraError ? (
          <p className="text-destructive text-sm">{cameraError}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFacingBack((v) => !v)}
          >
            <SwitchCamera className="mr-2 size-4" aria-hidden />
            {facingBack ? 'Ön kameraya geç' : 'Arka kameraya geç'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            <X className="mr-2 size-4" aria-hidden />
            Kamerayı kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
