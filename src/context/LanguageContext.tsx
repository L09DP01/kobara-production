"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language } from "@/config/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    // 1. Check cookie first for SSR sync
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
      return null;
    };

    const savedCookie = getCookie("kbr_lang") as Language | null;
    if (savedCookie === "fr" || savedCookie === "en" || savedCookie === "ht") {
      setLanguageState(savedCookie);
      return;
    }

    // 2. Check localStorage
    const savedLocal = localStorage.getItem("kbr_lang") as Language | null;
    if (savedLocal === "fr" || savedLocal === "en" || savedLocal === "ht") {
      setLanguageState(savedLocal);
      return;
    }

    // 3. Fallback to browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("fr")) {
      setLanguageState("fr");
    } else {
      setLanguageState("en");
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    // Persist in localStorage
    localStorage.setItem("kbr_lang", lang);
    // Persist in cookie (expires in 1 year)
    document.cookie = `kbr_lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  };

  const t = (keyPath: string): string => {
    const parts = keyPath.split(".");
    let current: any = translations[language];

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        // Fallback to searching french then english then the key itself
        let fallback: any = translations["fr"];
        let found = true;
        for (const p of parts) {
          if (fallback && typeof fallback === "object" && p in fallback) {
            fallback = fallback[p];
          } else {
            found = false;
            break;
          }
        }
        if (found && typeof fallback === "string") return fallback;
        
        return keyPath;
      }
    }

    return typeof current === "string" ? current : keyPath;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
