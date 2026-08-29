import { cookies } from "next/headers";
import { translations, Language } from "@/config/translations";

export async function getServerTranslation() {
  let language: Language = "fr";
  
  try {
    const cookieStore = await cookies();
    const langCookie = cookieStore.get("kbr_lang")?.value as Language | undefined;
    if (langCookie === "fr" || langCookie === "en" || langCookie === "ht") {
      language = langCookie;
    }
  } catch (e) {
    // Fail-safe for build static page generation or edge runtime issues
    language = "fr";
  }

  const t = (keyPath: string): string => {
    const parts = keyPath.split(".");
    let current: any = translations[language];

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        // Fallback search in french
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

  return { t, language };
}
