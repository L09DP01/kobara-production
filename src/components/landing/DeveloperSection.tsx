"use client";

import { motion } from "framer-motion";
import { Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";

const CODE_SNIPPET = `import kobara from 'kobara-sdk';
const client = kobara('sk_test_...');

// Create a payment charge
const charge = await kobara.charges.create({
  amount: 2500, // HTG
  currency: 'HTG',
  description: 'Order #1234',
  redirect_url: 'https://mysite.com/success'
});

console.log(charge.payment_url);`;

export function DeveloperSection() {
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(CODE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const listItems = language === "fr" ? [
    "Documentation API complète et interactive",
    "SDKs officiels pour Node, PHP, Python",
    "Outils de test d'événements en temps réel",
    "Environnement de sandbox hautement sécurisé"
  ] : [
    "Comprehensive and interactive API documentation",
    "Official SDKs for Node, PHP, Python",
    "Real-time event testing tools",
    "Secure sandbox development environment"
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-sm font-bold text-kobara-orange">
              {t("home.devBadge")}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-kobara-primary tracking-tighter leading-[1.1]">
              {language === "fr" ? "Une intégration en quelques minutes, pas en quelques semaines." : "Integration that takes minutes, not weeks."}
            </h2>
            <p className="text-lg text-kobara-secondary font-medium leading-relaxed max-w-xl">
              {t("home.devDesc")}
            </p>
            
            <ul className="space-y-4 pt-4">
              {listItems.map((item, i) => (
                <li key={i} className="flex items-start sm:items-center gap-3 text-kobara-primary font-bold">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Code Window */}
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="relative w-full min-w-0"
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-kobara-orange/20 to-kobara-red/20 blur-3xl opacity-30 -z-10 rounded-[40px]" />
            
            <div className="glass rounded-[32px] border-white overflow-hidden shadow-2xl w-full">
              {/* Header */}
              <div className="bg-slate-900/80 px-6 py-4 flex items-center justify-between border-b border-white/10">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Terminal className="w-4 h-4" />
                  nodejs
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Body */}
              <div className="bg-slate-950 p-5 md:p-8 font-mono text-[12px] md:text-[14px] leading-relaxed overflow-x-auto">
                <pre className="text-slate-300">
                  {CODE_SNIPPET.split('\n').map((line, i) => (
                    <div key={i} className="flex gap-4 md:gap-6">
                      <span className="text-slate-700 select-none w-4 shrink-0 text-right">{i + 1}</span>
                      <span className="whitespace-pre">
                        {line.includes('//') ? (
                          <span className="text-slate-500 italic">{line}</span>
                        ) : line.includes("'") || line.includes('"') ? (
                          <span>
                            {line.split(/(['"].*?['"])/).map((part, j) => 
                              part.startsWith("'") || part.startsWith('"') ? (
                                <span key={j} className="text-emerald-400">{part}</span>
                              ) : (
                                <span key={j}>{part}</span>
                              )
                            )}
                          </span>
                        ) : (
                          line
                        )}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

