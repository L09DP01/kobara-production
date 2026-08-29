"use client";

import React, { useState, useEffect, useRef } from 'react';
import { CameraCapture } from './CameraCapture';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LivenessCheckProps {
  challengeId: string;
  instruction: string;
  onVerifyComplete: (frames: Blob[]) => Promise<void>;
}

export function LivenessCheck({ challengeId, instruction, onVerifyComplete }: LivenessCheckProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Internal ref to access the video element directly for capturing frames
  const containerRef = useRef<HTMLDivElement>(null);
  
  const startRecording = () => {
    setIsRecording(true);
    setCountdown(3);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isRecording && countdown === 0) {
      captureFramesAndSubmit();
    }
    return () => clearTimeout(timer);
  }, [isRecording, countdown]);

  const captureFramesAndSubmit = async () => {
    setIsSubmitting(true);
    
    // We need to capture 3-5 frames over ~1.5 seconds
    const frames: Blob[] = [];
    const video = containerRef.current?.querySelector('video');
    const canvas = document.createElement('canvas');
    
    if (video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Capture 5 frames, one every 300ms
        for (let i = 0; i < 5; i++) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
          if (blob) frames.push(blob);
          
          if (i < 4) { // don't wait after the last frame
             await new Promise(r => setTimeout(r, 300));
          }
        }
      }
    }
    
    await onVerifyComplete(frames);
    setIsSubmitting(false);
    setIsRecording(false);
  };

  const livenessInstruction = "Suivez l’instruction affichée pour prouver que vous êtes bien présent devant la caméra.";

  return (
    <div className="w-full text-center" ref={containerRef}>
      <div className="mb-4">
        <h3 className="text-xl font-bold text-primary mb-2">{instruction}</h3>
        <p className="text-sm text-text-secondary">{livenessInstruction}</p>
      </div>
      
      <div className="scale-x-[-1] mb-6">
        <div className="scale-x-[-1] relative">
          <CameraCapture 
            facingMode="user"
            onCapture={() => {}} // Not used manually here
            isRecording={isRecording}
          />
          
          {isRecording && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-sm">
              <span className="text-6xl font-bold text-white drop-shadow-lg">
                {countdown > 0 ? countdown : <Loader2 className="w-12 h-12 animate-spin" />}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {!isRecording && !isSubmitting && (
        <Button onClick={startRecording} className="w-full max-w-xs mx-auto" size="lg">
          Commencer l'action
        </Button>
      )}
      
      {isSubmitting && (
        <p className="text-sm text-text-secondary flex items-center justify-center mt-4">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Analyse en cours...
        </p>
      )}
    </div>
  );
}
