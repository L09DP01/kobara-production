"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, MessageSquare, HelpCircle } from 'lucide-react';

interface CameraCaptureProps {
  facingMode?: 'user' | 'environment';
  onCapture: (blob: Blob) => void;
  overlay?: React.ReactNode;
  instruction?: string;
  isRecording?: boolean;
}

export function CameraCapture({ facingMode = 'environment', onCapture, overlay, instruction, isRecording }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const startCamera = useCallback(async () => {
    setIsRetrying(true);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("L'API MediaDevices n'est pas supportée sur ce navigateur");
      }

      let newStream: MediaStream | null = null;

      // Tentative 1 : Avec facingMode ideal
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        // Tentative 2 : Vidéo générique sans contrainte stricte
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e2) {
          throw e2;
        }
      }

      if (newStream) {
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
        setHasPermission(true);
      }
    } catch (err) {
      console.warn("Accès direct à la caméra indisponible ou refusé, bascule vers la caméra native:", err);
      setHasPermission(false);
    } finally {
      setIsRetrying(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/webp', 0.9);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
    }
  };

  // Écran de secours si la caméra WebRTC est bloquée par le navigateur ou refusée
  if (hasPermission === false) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-slate-900/95 border border-slate-800 rounded-2xl text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <Camera className="w-8 h-8 text-orange-400" />
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">Caméra en direct bloquée</h3>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          L'accès vidéo dans le navigateur est bloqué. Vous pouvez ouvrir directement l'appareil photo de votre smartphone pour prendre votre photo.
        </p>

        {/* Input appareil photo natif */}
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          capture={facingMode === 'user' ? 'user' : 'environment'}
          onChange={handleFileChange}
          className="hidden" 
        />

        <div className="space-y-3 mb-6">
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3.5 h-auto shadow-lg shadow-orange-500/20"
          >
            <Camera className="w-5 h-5 mr-2" />
            Ouvrir l'appareil photo
          </Button>

          <Button 
            variant="outline"
            asChild
            className="w-full border-slate-700 hover:bg-slate-800 text-slate-200 py-3 h-auto"
          >
            <Link href="/dashboard/support">
              <MessageSquare className="w-5 h-5 mr-2 text-orange-400" />
              Contacter le support
            </Link>
          </Button>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Autoriser : cliquez sur le cadenas 🔒 de l'URL</span>
          <button 
            onClick={startCamera} 
            disabled={isRetrying}
            className="ml-2 text-orange-400 hover:underline flex items-center font-medium whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] sm:aspect-square bg-black rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-slate-800">
      {/* Input appareil photo natif de secours */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        capture={facingMode === 'user' ? 'user' : 'environment'}
        onChange={handleFileChange}
        className="hidden" 
      />

      {instruction && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-black/70 backdrop-blur-md p-3 rounded-xl text-center border border-white/10">
          <p className="text-white text-xs sm:text-sm font-medium">{instruction}</p>
        </div>
      )}
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {overlay && (
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          {overlay}
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />

      {!isRecording && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 z-10 px-6">
          {/* Bouton Support */}
          <Link 
            href="/dashboard/support"
            title="Besoin d'aide ? Contacter le support"
            className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all"
          >
            <HelpCircle className="w-5 h-5 text-slate-300" />
          </Link>

          {/* Déclencheur principal */}
          <button 
            onClick={handleCapture}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-4 border-white flex items-center justify-center hover:bg-white/40 active:scale-95 transition-all shadow-xl"
          >
            <div className="w-12 h-12 rounded-full bg-white shadow-lg"></div>
          </button>

          {/* Bouton appareil photo natif */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            title="Ouvrir l'appareil photo du téléphone"
            className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all"
          >
            <Camera className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      )}
    </div>
  );
}
