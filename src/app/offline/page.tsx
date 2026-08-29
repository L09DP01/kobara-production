"use client";

import Image from "next/image";
import { WifiOff, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function OfflinePage() {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#050D1A] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden selection:bg-blue-500/30">
      
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Optional Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 z-10"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/10 shadow-lg flex items-center justify-center grayscale">
            <div className="w-4 h-4 bg-white rounded-sm" />
          </div>
          <span className="text-xl font-bold text-slate-400 tracking-tight grayscale">Kobara</span>
        </div>
      </motion.div>
      
      {/* Icon with pulsing animation */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 mb-8"
      >
        <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
        <div className="relative w-24 h-24 bg-[#0A1628] border border-red-500/20 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/10">
          <WifiOff className="w-10 h-10 text-red-400" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="z-10 max-w-sm"
      >
        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
          Pas de connexion
        </h1>
        <p className="text-slate-400 mb-10 leading-relaxed text-sm">
          Kobara a besoin d'une connexion internet pour synchroniser vos transactions. Veuillez vérifier votre réseau Wi-Fi ou mobile.
        </p>
        
        {/* Action Button */}
        <button 
          onClick={handleReload}
          className="group relative inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-white text-black rounded-xl font-semibold hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          Réessayer la connexion
        </button>
      </motion.div>

      {/* Bottom Legal/Hint */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-600 font-medium">
        L'application se reconnectera automatiquement.
      </div>
    </div>
  );
}
