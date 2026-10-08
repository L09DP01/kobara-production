"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

export function ArticleFeedback({ articleId }: { articleId: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);

  if (answer) {
    return (
      <div className="flex min-h-24 items-center gap-3 border-t border-[#E3DEDA] py-7 text-sm font-semibold text-[#333847]" data-article-id={articleId}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E9F8F1] text-[#087A55]"><Check className="h-4 w-4" /></span>
        Merci. Votre réponse nous aide à améliorer cet article.
      </div>
    );
  }

  return (
    <div className="border-t border-[#E3DEDA] py-7" data-article-id={articleId}>
      <p className="font-bold text-[#10131D]">Cet article vous a-t-il aidé ?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setAnswer("yes")} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8D3CF] bg-white px-4 text-sm font-bold text-[#333847] hover:border-[#F45D2C] hover:text-[#E34A1F]"><ThumbsUp className="h-4 w-4" /> Oui</button>
        <button type="button" onClick={() => setAnswer("no")} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8D3CF] bg-white px-4 text-sm font-bold text-[#333847] hover:border-[#F45D2C] hover:text-[#E34A1F]"><ThumbsDown className="h-4 w-4" /> Non</button>
      </div>
    </div>
  );
}
