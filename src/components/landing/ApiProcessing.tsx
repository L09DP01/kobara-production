"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/context/LanguageContext";

export function ApiProcessing() {
  const { t } = useTranslation();

  return (
    <section id="api" className="relative scroll-mt-24 overflow-hidden border-y border-white/[0.06] bg-[#020B14] py-16 md:py-24">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(30,42,56,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(30,42,56,0.3)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
      
      {/* Large Background Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[min(760px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#FF4A1C]/5 blur-[120px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <p className="text-sm font-bold text-[#FF4A1C] tracking-widest uppercase mb-4">
            {t("home.apiPreTitle")}
          </p>
          <h2 className="mb-5 text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
            {t("home.apiTitle1")} <br className="hidden md:block"/> {t("home.apiTitle2")}
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-7 text-[#AAB3C2] sm:text-lg">
            {t("home.apiSubtitle")}
          </p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] lg:gap-6">
          
          {/* Left Block - Realistic IDE (Backend) */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#1E2A38] bg-[#07111F] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          >
            {/* IDE Header */}
            <div className="flex items-center px-4 py-3 bg-[#020B14] border-b border-[#1E2A38]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto flex items-center gap-2 px-3 py-1 bg-[#07111F] rounded-md border border-[#1E2A38] text-xs text-[#AAB3C2] font-mono">
                <span className="text-yellow-400">TS</span> payment.ts
              </div>
            </div>

            {/* IDE Code */}
            <div className="p-4 sm:overflow-x-auto sm:p-5">
              <pre className="min-w-0 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-300 [&>div>span:last-child]:min-w-0 [&>div>span:last-child]:break-words sm:min-w-[540px] sm:whitespace-pre sm:text-[13px]">
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">1</span>
                  <span><span className="text-purple-400">import</span> {`{`} Kobara {`}`} <span className="text-purple-400">from</span> <span className="text-green-400">{"'@kobara/node'"}</span>;</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">2</span>
                  <span></span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">3</span>
                  <span><span className="text-purple-400">const</span> kobara = <span className="text-purple-400">new</span> <span className="text-yellow-200">Kobara</span>(<span className="text-blue-300">process.env.</span><span className="text-white">KOBARA_KEY</span>);</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">4</span>
                  <span></span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">5</span>
                  <span><span className="text-purple-400">const</span> <span className="text-blue-400">createPayment</span> = <span className="text-purple-400">async</span> () {`=>`} {`{`}</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">6</span>
                  <span>  <span className="text-purple-400">const</span> payment = <span className="text-purple-400">await</span> kobara.payments.<span className="text-blue-400">create</span>({`{`}</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">7</span>
                  <span>    <span className="text-blue-200">amount</span>: <span className="text-orange-400">2500</span>,</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">8</span>
                  <span>    <span className="text-blue-200">currency</span>: <span className="text-green-400">{'"HTG"'}</span>,</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">9</span>
                  <span>    <span className="text-blue-200">method</span>: <span className="text-green-400">{'"moncash"'}</span>,</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">10</span>
                  <span>    <span className="text-blue-200">customer</span>: {`{`}</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">11</span>
                  <span>      <span className="text-blue-200">phone</span>: <span className="text-green-400">{'"+509XXXXXXXX"'}</span></span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">12</span>
                  <span>    {`}`}</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">13</span>
                  <span>  {`}`});</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">14</span>
                  <span>  <span className="text-purple-400">return</span> payment;</span>
                </div>
                <div className="flex">
                  <span className="text-[#475569] mr-4 select-none">15</span>
                  <span>{`}`};</span>
                </div>
              </pre>
            </div>
          </motion.div>

          {/* Center Block - Realistic Kobara API Gateway */}
          <div className="relative flex flex-col items-center justify-center py-12 lg:py-16">
            <div className="absolute bottom-0 top-0 left-1/2 w-px -translate-x-1/2 overflow-hidden bg-[#1E2A38] lg:hidden">
              <motion.div
                className="h-20 w-full bg-[#FF4A1C] shadow-[0_0_10px_#FF4A1C]"
                animate={{ y: ["-100%", "500%"] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              />
            </div>
            
            {/* Animated Data Stream from Left */}
            <div className="absolute left-[-30%] lg:left-[-20%] top-1/2 -translate-y-1/2 w-32 h-[2px] bg-[#1E2A38] hidden lg:block overflow-hidden">
               <motion.div 
                  className="w-1/2 h-full bg-[#FF4A1C] shadow-[0_0_10px_#FF4A1C]"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
               />
            </div>

            {/* Glowing API Core */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
              className="relative z-20"
            >
              <div className="w-32 h-32 relative flex items-center justify-center">
                {/* Outer Rotating Rings */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                  className="absolute inset-[-20px] rounded-full border border-dashed border-[#FF4A1C]/30"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                  className="absolute inset-[-10px] rounded-full border border-dotted border-[#FF4A1C]/50"
                />
                
                {/* Core Hexagon / Server */}
                <div className="w-full h-full bg-gradient-to-br from-[#1E2A38] to-[#020B14] rounded-2xl border border-[#FF4A1C]/40 shadow-[0_0_50px_rgba(255,74,28,0.2),inset_0_0_20px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center relative overflow-hidden transform rotate-45">
                   <div className="absolute inset-0 bg-gradient-to-t from-[#FF4A1C]/20 to-transparent" />
                   <div className="transform -rotate-45 flex flex-col items-center">
                     <Image src="/Icone.png" alt="Kobara Core" width={40} height={40} className="mb-2 h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(255,74,28,0.8)]" />
                     <div className="flex gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse delay-75" />
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse delay-150" />
                     </div>
                   </div>
                </div>
              </div>
            </motion.div>
            
            <div className="mt-8 flex flex-col items-center">
              <span className="text-white font-bold text-sm">Kobara API</span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[#AAB3C2]">
                <motion.span className="h-1.5 w-1.5 rounded-full bg-green-500" animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.6, repeat: Infinity }} />
                Opérationnelle
              </span>
            </div>

            {/* Animated Data Stream to Right */}
            <div className="absolute right-[-30%] lg:right-[-20%] top-1/2 -translate-y-1/2 w-32 h-[2px] bg-[#1E2A38] hidden lg:block overflow-hidden">
               <motion.div 
                  className="w-1/2 h-full bg-[#FF4A1C] shadow-[0_0_10px_#FF4A1C]"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: 0.75 }}
               />
            </div>
          </div>

          {/* Right Block - Realistic Push Notification / Webhook Result */}
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            className="flex min-w-0 flex-col gap-4"
          >
            {/* Webhook Header Mock */}
            <div className="flex items-center gap-3 self-start rounded-full border border-[#1E2A38] bg-[#07111F] px-4 py-2 shadow-lg">
              <motion.div className="h-2 w-2 rounded-full bg-green-500" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }} />
              <span className="text-xs text-[#AAB3C2] font-mono">POST /webhook 200 OK</span>
            </div>

            {/* Success Card Mockup */}
            <div className="relative overflow-hidden rounded-lg border border-[#1E2A38] bg-gradient-to-b from-[#1E2A38]/50 to-[#020B14] p-1 shadow-2xl backdrop-blur-md">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50" />
              
              <div className="bg-[#07111F] rounded-xl p-6 relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Payment Received</h3>
                      <p className="text-[#AAB3C2] text-xs">Just now</p>
                    </div>
                  </div>
                  <Image src="/Icone.png" alt="Kobara" width={20} height={20} className="h-5 w-5 opacity-50 grayscale" />
                </div>

                <div className="p-4 bg-[#020B14] rounded-lg border border-[#1E2A38] mb-4">
                  <div className="text-3xl font-bold text-white mb-1">2,500 <span className="text-lg text-[#AAB3C2] font-medium">HTG</span></div>
                  <div className="text-[#AAB3C2] text-sm">from +509 XX XXX XXX</div>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full flex justify-between text-xs">
                    <span className="text-[#AAB3C2]">Method</span>
                    <span className="text-white font-medium flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-[6px] font-bold">M</span>
                      MonCash
                    </span>
                  </div>
                  <div className="w-full flex justify-between text-xs">
                    <span className="text-[#AAB3C2]">Transaction ID</span>
                    <span className="text-white font-mono">KB-2039</span>
                  </div>
                  <div className="w-full flex justify-between text-xs">
                    <span className="text-[#AAB3C2]">Status</span>
                    <span className="text-green-500 font-medium">Succeeded</span>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
}
