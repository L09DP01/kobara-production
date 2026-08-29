"use client";

import React, { useState } from 'react';
import { CameraCapture } from './CameraCapture';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface DocumentCaptureProps {
  documentType: string;
  side: 'front' | 'back' | 'passport_page';
  onCaptureComplete: (blob: Blob) => Promise<void>;
}

export function DocumentCapture({ documentType, side, onCaptureComplete }: DocumentCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  let instruction = "Placez votre document devant la caméra. Assurez-vous que les quatre coins sont visibles et que le texte est lisible.";
  if (side === 'passport_page') instruction = "Capturez la page principale de votre passeport.";
  else if (side === 'front') instruction = "Capturez le recto de votre document.";
  else if (side === 'back') instruction = "Capturez le verso de votre document.";

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
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Document capture" className="w-full h-full object-contain" />
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

  const documentOverlay = (
    <div className="w-[85%] h-[60%] border-2 border-white/50 rounded-xl relative">
       <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-0.5 -ml-0.5"></div>
       <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-0.5 -mr-0.5"></div>
       <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-0.5 -ml-0.5"></div>
       <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-0.5 -mr-0.5"></div>
    </div>
  );

  return (
    <div className="w-full">
      <CameraCapture 
        facingMode="environment"
        instruction={instruction}
        overlay={documentOverlay}
        onCapture={handleCapture}
      />
    </div>
  );
}
