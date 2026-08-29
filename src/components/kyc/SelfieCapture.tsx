"use client";

import React, { useState } from 'react';
import { CameraCapture } from './CameraCapture';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SelfieCaptureProps {
  onCaptureComplete: (blob: Blob) => Promise<void>;
}

export function SelfieCapture({ onCaptureComplete }: SelfieCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const instruction = "Placez votre visage au centre. Ne portez pas de lunettes sombres. Utilisez un bon éclairage.";

  const handleCapture = (capturedBlob: Blob) => {
    setBlob(capturedBlob);
    setPreview(URL.createObjectURL(capturedBlob));
  };

  const handleRetake = () => {
    setBlob(null);
    setPreview(null);
  };

  const handleConfirm = async () => {
    if (!blob) return;
    setIsSubmitting(true);
    try {
      await onCaptureComplete(blob);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (preview) {
    return (
      <div className="w-full max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-text-primary mb-4 text-center">Vérifiez la qualité</h3>
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] sm:aspect-square mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selfie capture" className="w-full h-full object-cover scale-x-[-1]" />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleRetake} disabled={isSubmitting}>
            Reprendre
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Continuer
          </Button>
        </div>
      </div>
    );
  }

  const faceOverlay = (
    <div className="w-[60%] h-[55%] border-2 border-white/50 rounded-[40%] relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full"></div>
       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full"></div>
       <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-12 bg-primary rounded-full"></div>
       <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 bg-primary rounded-full"></div>
    </div>
  );

  return (
    <div className="w-full scale-x-[-1]"> 
      {/* scale-x-[-1] acts as a mirror for the user facing camera */}
      <div className="scale-x-[-1]">
        <CameraCapture 
          facingMode="user"
          instruction={instruction}
          overlay={faceOverlay}
          onCapture={handleCapture}
        />
      </div>
    </div>
  );
}
