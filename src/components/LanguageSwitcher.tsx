"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { Language } from "@/config/translations";
import clsx from "clsx";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages = [
    { code: "fr" as Language, label: "Français", flag: "🇫🇷" },
    { code: "en" as Language, label: "English", flag: "🇺🇸" },
  ];

  const currentLang = languages.find((lang) => lang.code === language) || languages[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-body-sm font-medium border border-white/20 bg-white/10 backdrop-blur-md text-kobara-primary hover:bg-white/20 transition-all duration-200 cursor-pointer shadow-sm active:scale-95",
          isOpen && "bg-white/25 border-white/40"
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="text-base select-none">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.label}</span>
        <span className="material-symbols-outlined text-[16px] transition-transform duration-200 select-none" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-white/60 dark:border-zinc-800/60 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={clsx(
                  "flex items-center w-full text-left px-4 py-2.5 text-body-sm transition-colors duration-150 gap-3 cursor-pointer",
                  lang.code === language
                    ? "bg-rose-50 text-rose-600 font-semibold dark:bg-rose-950/20 dark:text-rose-400"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                )}
              >
                <span className="text-base select-none">{lang.flag}</span>
                <span>{lang.label}</span>
                {lang.code === language && (
                  <span className="material-symbols-outlined ml-auto text-rose-500 dark:text-rose-400 text-[18px]">
                    check
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
