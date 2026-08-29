"use client";

import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, Zap, Server, Lock, Wifi, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthVisual() {
  const [codeIndex, setCodeIndex] = useState(0);
  const codeLines = [
    "POST /api/v1/payments",
    "Headers: { Authorization: 'Bearer kobara_live_***' }",
    "Body: {",
    "  amount: 2500,",
    "  currency: 'HTG',",
    "  method: 'moncash',",
    "  customer_phone: '+509 3000-0000'",
    "}",
    "...",
    "Status: 200 OK",
    "Response: { id: 'pay_9x8f...', status: 'processing' }"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCodeIndex((prev) => (prev + 1) % (codeLines.length + 5)); // +5 for pause
    }, 400);
    return () => clearInterval(interval);
  }, [codeLines.length]);

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-between p-8 xl:p-12 bg-[#020B14]">
      
      {/* Dynamic Mesh Background */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#FF4A1C]/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#FF2E14]/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-[#27C93F]/5 rounded-full blur-[80px] mix-blend-screen" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(30,42,56,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(30,42,56,0.3)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none" />

      {/* Main Scene Container */}
      <div className="relative flex-1 flex items-center justify-center min-h-[600px] w-full">
        
        {/* ==================== */}
        {/* REALISTIC GLASS DASHBOARD */}
        {/* ==================== */}
        
        <motion.div 
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[80%] max-w-[600px] aspect-[16/10] bg-gradient-to-br from-[#07111F]/90 to-[#020B14]/95 backdrop-blur-2xl rounded-3xl border border-[#1E2A38] shadow-[0_30px_100px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden flex flex-col z-10"
        >
          {/* Mac-like Header */}
          <div className="h-12 w-full border-b border-[#1E2A38] bg-[#07111F]/50 flex items-center px-4 justify-between">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_10px_rgba(255,95,86,0.5)]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_10px_rgba(255,189,46,0.5)]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_10px_rgba(39,201,63,0.5)]" />
            </div>
            <div className="flex items-center gap-2 text-[#AAB3C2] bg-[#020B14] px-3 py-1 rounded-md border border-[#1E2A38] text-[11px] font-mono shadow-inner">
              <Lock className="w-3 h-3" /> api.kobara.app
            </div>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4A1C]/5 rounded-full blur-[60px]" />
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-white font-bold text-lg">Transaction Live Stream</h3>
                <p className="text-[#AAB3C2] text-xs mt-1">Monitoring API events in real-time</p>
              </div>
              <div className="px-3 py-1 bg-[#27C93F]/10 border border-[#27C93F]/20 rounded-full text-[#27C93F] text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(39,201,63,0.1)]">
                <div className="w-1.5 h-1.5 bg-[#27C93F] rounded-full animate-pulse" />
                SYSTEM OPERATIONAL
              </div>
            </div>

            {/* Simulated Live Chart / Graph Area */}
            <div className="w-full h-32 flex items-end gap-2 mb-6">
              {[40, 65, 45, 80, 55, 90, 70, 100, 85, 60].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[#FF4A1C]/5 to-transparent rounded-t-sm relative group cursor-pointer" style={{ height: '100%' }}>
                  <motion.div 
                    initial={{ height: "0%" }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                    className="absolute bottom-0 w-full bg-gradient-to-t from-[#FF4A1C]/80 to-[#FF4A1C] rounded-t-sm shadow-[0_0_10px_rgba(255,74,28,0.3)] group-hover:from-[#FF4A1C] group-hover:to-[#FF2E14] transition-all"
                  />
                </div>
              ))}
            </div>

            {/* Recent Transaction Row */}
            <div className="w-full bg-[#020B14] border border-[#1E2A38] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#27C93F]/10 flex items-center justify-center border border-[#27C93F]/20">
                  <CheckCircle2 className="w-5 h-5 text-[#27C93F]" />
                </div>
                <div>
                  <div className="text-white text-sm font-bold">Payment via MonCash</div>
                  <div className="text-[#AAB3C2] text-xs">pay_8x7d9f...</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">+ 2,500 HTG</div>
                <div className="text-[#27C93F] text-[10px]">Succeeded</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ==================== */}
        {/* FLOATING REALISTIC TERMINAL */}
        {/* ==================== */}
        <motion.div 
          animate={{ y: [10, -10, 10] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute right-[2%] xl:right-[5%] bottom-[10%] w-[280px] xl:w-[320px] bg-[#000000]/80 backdrop-blur-3xl border border-[#334155] rounded-xl shadow-[0_40px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden z-20"
        >
          <div className="h-10 bg-[#1E2A38]/30 flex items-center px-4 gap-2 border-b border-[#334155]/50">
            <Terminal className="w-4 h-4 text-[#AAB3C2]" />
            <span className="text-[#AAB3C2] text-xs font-mono">Terminal — node server.js</span>
          </div>
          <div className="p-4 font-mono text-[11px] leading-relaxed text-[#AAB3C2]">
            {codeLines.map((line, i) => (
              <div 
                key={i} 
                className={`transition-opacity duration-300 ${i <= codeIndex ? 'opacity-100' : 'opacity-0 hidden'}`}
              >
                {line.includes('POST') ? (
                  <><span className="text-[#27C93F]">➜</span> <span className="text-[#FF4A1C] font-bold">POST</span> {line.replace('POST ', '')}</>
                ) : line.includes('200 OK') ? (
                  <span className="text-[#27C93F] font-bold">{line}</span>
                ) : line.includes('HTG') || line.includes('2500') || line.includes('moncash') ? (
                  <span className="text-white">{line}</span>
                ) : (
                  line
                )}
              </div>
            ))}
            <motion.div 
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block w-2 h-3 bg-[#FF4A1C] ml-1 align-middle"
            />
          </div>
        </motion.div>

        {/* ==================== */}
        {/* FLOATING SECURITY BADGE */}
        {/* ==================== */}
        <motion.div 
          animate={{ y: [-5, 5, -5], rotateZ: [-2, 2, -2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -left-[5%] top-[15%] bg-gradient-to-br from-[#07111F] to-[#020B14] border border-[#FF4A1C]/30 rounded-2xl p-4 flex items-center gap-4 shadow-[0_20px_40px_rgba(255,74,28,0.15)] z-20 backdrop-blur-xl"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[#FF4A1C] rounded-full blur-md opacity-40 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-[#020B14] flex items-center justify-center border border-[#FF4A1C] text-[#FF4A1C] relative z-10 shadow-[inset_0_0_15px_rgba(255,74,28,0.3)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">Military Grade</div>
            <div className="text-xs font-semibold text-[#FF4A1C] mt-0.5 uppercase tracking-wider">MonCash Secured</div>
          </div>
        </motion.div>

      </div>

      {/* Marketing & Trust Indicators (Bottom) */}
      <div className="relative z-20 mt-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tighter mb-4 drop-shadow-lg">
            Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4A1C] to-[#FF8A00]">MonCash</span><br />
            Infrastructure For Haiti
          </h2>
          <p className="text-[#AAB3C2] text-sm font-medium max-w-lg mx-auto leading-relaxed">
            A developer-first platform designed to handle large-scale mobile money transactions with military-grade security and ultra-low latency.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 xl:gap-6 border-t border-[#1E2A38] pt-6 max-w-2xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#07111F] to-[#020B14] border border-[#1E2A38] flex items-center justify-center text-[#FF4A1C] mb-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-white font-bold text-[12px] xl:text-[13px] mb-1">Sécurisé</h4>
            <p className="text-[#AAB3C2] text-[10px] xl:text-[11px] leading-relaxed hidden sm:block">Protection de niveau bancaire 256-bit</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#07111F] to-[#020B14] border border-[#1E2A38] flex items-center justify-center text-[#FF4A1C] mb-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-white font-bold text-[12px] xl:text-[13px] mb-1">Rapide</h4>
            <p className="text-[#AAB3C2] text-[10px] xl:text-[11px] leading-relaxed hidden sm:block">Transactions validées en &lt; 200ms</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#07111F] to-[#020B14] border border-[#1E2A38] flex items-center justify-center text-[#FF4A1C] mb-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              <Server className="w-4 h-4" />
            </div>
            <h4 className="text-white font-bold text-[12px] xl:text-[13px] mb-1">Fiable</h4>
            <p className="text-[#AAB3C2] text-[10px] xl:text-[11px] leading-relaxed hidden sm:block">Disponibilité garantie à 99.99%</p>
          </div>
        </div>
      </div>

    </div>
  );
}
