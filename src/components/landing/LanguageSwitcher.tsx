"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";
import { Language } from "@/config/translations";

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-32 h-8" />;

  return (
    <div className="flex items-center gap-2 bg-[#07111F] border border-[#1E2A38] rounded-xl px-3 py-1.5 transition-colors hover:border-[#334155]">
      <Globe className="w-4 h-4 text-[#AAB3C2]" />
      <select 
        value={language} 
        onChange={(e) => setLanguage(e.target.value as Language)} 
        className="bg-transparent text-xs text-[#AAB3C2] font-medium focus:outline-none cursor-pointer appearance-none outline-none"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        <option value="fr" className="bg-[#020B14] text-white">Français</option>
        <option value="en" className="bg-[#020B14] text-white">English</option>
        <option value="ht" className="bg-[#020B14] text-white">Kreyòl Ayisyen</option>
      </select>
    </div>
  );
}
