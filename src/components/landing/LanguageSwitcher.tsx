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
    <div className="flex items-center gap-2 rounded-md border border-[#DDD7D3] bg-white px-3 py-1.5 transition-colors hover:border-[#F45D2C]">
      <Globe className="w-4 h-4 text-[#5C5E66]" />
      <select 
        value={language} 
        onChange={(e) => setLanguage(e.target.value as Language)} 
        className="cursor-pointer appearance-none bg-transparent text-xs font-medium text-[#333847] outline-none focus:outline-none"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
        <option value="ht">Kreyòl Ayisyen</option>
      </select>
    </div>
  );
}
