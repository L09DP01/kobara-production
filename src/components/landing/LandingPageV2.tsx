"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, Check, CheckCircle2,
  ChevronRight, Code2, CreditCard, FileText, Globe2, KeyRound, Link2,
  MousePointer2, ShieldCheck, WalletCards, Webhook, Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useTranslation } from "@/context/LanguageContext";
import { PublicHeader } from "@/components/marketing/PublicNavigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

const copyByLocale = {
  fr: {
    title: "Tous vos paiements. Une seule intégration.",
    intro: "Acceptez MonCash, NatCash et les moyens activés sur votre compte avec une infrastructure pensée pour les entreprises haïtiennes.",
    primary: "Créer un compte",
    secondary: "Voir la documentation",
  },
  en: {
    title: "All your payments. One integration.",
    intro: "Accept MonCash, NatCash and the methods enabled on your account with infrastructure built for Haitian businesses.",
    primary: "Create an account",
    secondary: "View documentation",
  },
  ht: {
    title: "Tout peman ou yo. Yon sèl entegrasyon.",
    intro: "Aksepte MonCash, NatCash ak mwayen ki aktive sou kont ou ak yon enfrastrikti ki fèt pou antrepriz ayisyen.",
    primary: "Kreye yon kont",
    secondary: "Gade dokimantasyon an",
  },
};

function HomeHeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-[22rem] -top-[52rem] h-[72rem] w-[96rem] rounded-full bg-[#FDE9E3]/80" />
      <div className="absolute -bottom-[36rem] -left-[20rem] h-[52rem] w-[92rem] rounded-[50%] bg-[#E9EDF1]/90" />
    </div>
  );
}

function AnimatedTrace() {
  const reduceMotion = useReducedMotion();
  return <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 overflow-hidden">
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#4D76E8]/60" />
    <motion.div initial={false} animate={reduceMotion ? undefined : { x: ["-45%", "145%"] }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }} className="absolute bottom-0 h-1.5 w-[34%] -skew-x-[28deg] bg-[#4D76E8] shadow-[0_0_18px_rgba(77,118,232,0.7)]" />
    <motion.div initial={false} animate={reduceMotion ? undefined : { x: ["-70%", "170%"] }} transition={{ duration: 9, repeat: Infinity, ease: "linear", delay: 1.3 }} className="absolute bottom-2 h-1 w-[20%] -skew-x-[28deg] bg-[#7DB7FF] opacity-75" />
    <motion.div initial={false} animate={reduceMotion ? undefined : { x: ["-80%", "180%"] }} transition={{ duration: 11, repeat: Infinity, ease: "linear", delay: 0.6 }} className="absolute bottom-0 h-1 w-[14%] -skew-x-[28deg] bg-[#F45D2C]" />
  </div>;
}

function HeroPaymentDemo() {
  const reduceMotion = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"idle" | "selected" | "continue" | "loading" | "success">("idle");
  const [showWebhook, setShowWebhook] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;

    const timers = [
      window.setTimeout(() => setPhase("selected"), 2000),
      window.setTimeout(() => setPhase("continue"), 2500),
      window.setTimeout(() => setPhase("loading"), 3200),
      window.setTimeout(() => setPhase("success"), 4500),
      window.setTimeout(() => setShowWebhook(true), 5000),
      window.setTimeout(() => setShowWebhook(false), 6000),
      window.setTimeout(() => setPhase("idle"), 7000),
      window.setTimeout(() => setCycle(current => current + 1), 8000),
    ];

    return () => timers.forEach(window.clearTimeout);
  }, [cycle, reduceMotion]);

  const selectedMethod = cycle % 2 === 0 ? "MonCash" : "NatCash";
  const methodSelected = reduceMotion || phase !== "idle";

  return <motion.div initial={reduceMotion ? false : { opacity: 0, x: 46, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.8, delay: reduceMotion ? 0 : 1, ease: [0.22, 1, 0.36, 1] }} className="relative mx-auto w-full max-w-[650px]">
    <div className="overflow-hidden rounded-lg border border-[#DAD4D0] bg-white shadow-[0_32px_80px_rgba(16,19,29,0.14)]">
      <div className="flex h-14 items-center justify-between border-b border-[#E7E1DD] px-5"><div className="flex items-center gap-3"><Image src="/Icone.png" alt="" width={28} height={28} className="h-7 w-7 rounded" /><span className="text-sm font-bold">Smartcore Academy</span></div><span className="flex items-center gap-2 text-[11px] font-semibold text-[#5C5E66]"><ShieldCheck className="h-4 w-4 text-[#F45D2C]" />Paiement sécurisé</span></div>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "loading" ? (
          <motion.div key="loading" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="relative grid min-h-[380px] place-items-center overflow-hidden bg-[#FCF7F4] px-6 text-center">
            <motion.div aria-hidden initial={{ left: "-35%" }} animate={{ left: "105%" }} transition={{ duration: 1.25, ease: "easeInOut" }} className="absolute bottom-0 h-0.5 w-[35%] bg-[#F45D2C] shadow-[0_0_14px_rgba(244,93,44,0.75)]" />
            <div><div className="relative mx-auto grid h-20 w-20 place-items-center"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border-2 border-[#FBCDB1] border-t-[#F45D2C]" /><Image src="/Icone.png" alt="Kobara" width={44} height={44} className="h-11 w-11 rounded-lg" /></div><p className="mt-6 text-lg font-bold">Paiement en cours...</p><p className="mt-2 text-sm text-[#5C5E66]">Connexion sécurisée avec {selectedMethod}</p></div>
          </motion.div>
        ) : phase === "success" ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="grid min-h-[380px] place-items-center bg-[#F7FBF8] px-6 text-center">
            <div><motion.div initial={{ scale: 0.55 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#E5F7EB] text-[#168447]"><Check className="h-10 w-10" strokeWidth={3} /></motion.div><p className="mt-6 text-2xl font-semibold">Paiement confirmé</p><p className="mt-2 text-sm text-[#5C5E66]">2 500 HTG payés avec {selectedMethod}</p><div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[#BDE7CA] bg-white px-4 py-2 text-xs font-bold text-[#168447]"><CheckCircle2 className="h-4 w-4" />Transaction confirmée</div></div>
          </motion.div>
        ) : (
          <motion.div key="checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-[1.4fr_0.8fr]">
            <div className="relative p-5 sm:p-7"><p className="text-sm font-bold">Choisissez votre moyen de paiement</p><div className="mt-5 space-y-3">{[["MonCash", "Paiement mobile Digicel", "/moncash.png"], ["NatCash", "Paiement mobile Natcom", "/natcash.png"], ["Crypto", "BTC, USDT, ETH et plus", ""]].map(([name, description, logo]) => { const selected = methodSelected && name === selectedMethod; return <motion.div key={name} animate={selected && phase === "selected" ? { scale: [1, 0.985, 1] } : { scale: 1 }} transition={{ duration: 0.28 }} className={`flex items-center justify-between rounded-md border p-4 transition-colors duration-200 ${selected ? "border-[#F45D2C] bg-[#FFF7F3]" : "border-[#DDD7D3] bg-white"}`}><div className="flex items-center gap-3"><span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-[#F45D2C]" : "border-[#9D9EA3]"}`}>{selected && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2.5 w-2.5 rounded-full bg-[#F45D2C]" />}</span><div><p className="text-sm font-bold">{name}</p><p className="text-[10px] text-[#9D9EA3]">{description}</p></div></div>{logo ? <Image src={logo} alt={name} width={46} height={28} className="h-6 w-auto object-contain" /> : <Globe2 className="h-5 w-5 text-[#F45D2C]" />}</motion.div>; })}</div><motion.button type="button" animate={phase === "continue" ? { scale: [1, 0.97, 1], boxShadow: "0 0 0 5px rgba(244,93,44,0.18)" } : { scale: 1, boxShadow: "0 0 0 0 rgba(244,93,44,0)" }} transition={{ duration: 0.3 }} className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-bold text-white transition-colors ${methodSelected ? "bg-[#F45D2C]" : "bg-[#B7B8BC]"}`}>Continuer<motion.span initial={false} animate={reduceMotion ? undefined : { x: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity }}><ArrowRight className="h-4 w-4" /></motion.span></motion.button>
              {!reduceMotion && <motion.div aria-hidden initial={{ left: "8%", top: "8%", opacity: 0 }} animate={{ left: phase === "continue" ? "76%" : "82%", top: phase === "continue" ? "88%" : selectedMethod === "MonCash" ? "34%" : "52%", opacity: phase === "idle" ? 0 : 1, scale: phase === "selected" || phase === "continue" ? [1, 0.82, 1] : 1 }} transition={{ left: { duration: 0.48, ease: "easeInOut" }, top: { duration: 0.48, ease: "easeInOut" }, opacity: { duration: 0.2 }, scale: { duration: 0.28 } }} className="pointer-events-none absolute z-20 text-[#315FCC] drop-shadow-[0_2px_2px_rgba(255,255,255,0.95)]"><MousePointer2 className="h-7 w-7 fill-[#7DB7FF]" /></motion.div>}
            </div>
            <aside className="hidden border-l border-[#E7E1DD] bg-[#FCF7F4] p-7 md:block"><p className="text-sm font-bold">Détails</p><p className="mt-1 text-xs text-[#5C5E66]">Lien de paiement</p><p className="mt-5 text-3xl font-semibold">2 500 <span className="text-sm text-[#F45D2C]">HTG</span></p><div className="mt-6 space-y-3 border-t border-[#DDD7D3] pt-5 text-xs"><div className="flex justify-between"><span className="text-[#5C5E66]">Article</span><span className="font-semibold">Formation Pro</span></div><div className="flex justify-between"><span className="text-[#5C5E66]">Quantité</span><span className="font-semibold">1</span></div><div className="flex justify-between"><span className="text-[#5C5E66]">Total</span><span className="font-bold">2 500 HTG</span></div></div><div className="mt-8 flex items-center gap-2 text-[10px] font-semibold text-[#5C5E66]"><motion.span initial={false} animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.7, repeat: Infinity }} className="h-2 w-2 rounded-full bg-[#F45D2C]" />Confirmation en temps réel</div></aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <AnimatePresence>{showWebhook && <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} className="absolute -right-2 bottom-5 z-30 flex items-center gap-3 rounded-md border border-[#CAD7F7] bg-white px-4 py-3 shadow-[0_18px_45px_rgba(16,19,29,0.16)] sm:-right-5"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#EAF0FF] text-[#315FCC]"><Webhook className="h-4 w-4" /></span><div><p className="font-mono text-[11px] font-bold text-[#315FCC]">payment.succeeded</p><p className="mt-0.5 text-[9px] text-[#5C5E66]">Webhook livré en temps réel</p></div></motion.div>}</AnimatePresence>
    <div aria-hidden="true" className="absolute -bottom-5 left-[8%] h-5 w-[84%] -skew-x-12 bg-[#E22F23]" /><div aria-hidden="true" className="absolute -bottom-5 left-[34%] h-5 w-[58%] -skew-x-12 bg-[#FC9A65]" />
  </motion.div>;
}

const benefits = [
  [Zap, "Convertissez davantage de clients", "Un checkout rapide, adapté au mobile et aux moyens de paiement que vos clients utilisent déjà."],
  [Globe2, "Une expérience locale", "Encaissez en HTG ou en USD avec MonCash, NatCash, cartes et actifs numériques depuis une seule intégration."],
  [ShieldCheck, "Moins de fraude, plus de contrôle", "KYC, statuts vérifiables et suivi des transactions protègent chaque étape du paiement."],
  [Code2, "Déployez plus rapidement", "Liens sans code, API, SDK et webhooks réduisent le temps nécessaire pour passer en production."],
] as const;

function Benefits() {
  return <section id="benefits" className="border-y border-[#D9DDE2] bg-[#F4F7FA]"><div className="mx-auto grid max-w-[1200px] grid-cols-2 lg:grid-cols-4">{benefits.map(([Icon, title, body], index) => <article key={title} className={`min-h-[230px] border-b border-[#D9DDE2] p-4 sm:min-h-[280px] sm:p-8 ${index % 2 === 0 ? "border-r" : ""} ${index > 1 ? "border-b-0" : ""} ${index < 3 ? "lg:border-r" : "lg:border-r-0"} lg:border-b-0`}><Icon className="h-6 w-6 text-[#F45D2C] sm:h-7 sm:w-7" /><h2 className="mt-8 text-base font-semibold leading-tight sm:mt-12 sm:text-xl">{title}</h2><p className="mt-3 text-xs leading-5 text-[#5C5E66] sm:mt-4 sm:text-sm sm:leading-6">{body}</p></article>)}</div></section>;
}

function TrustStrip() {
  return <section className="border-b border-[#DDD7D3] bg-white"><div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-5 py-8 sm:px-8"><p className="w-full text-xs font-bold text-[#5C5E66] lg:w-auto">UNE INFRASTRUCTURE POUR LE COMMERCE HAÏTIEN</p><div className="flex flex-wrap items-center gap-7 sm:gap-10"><PaymentBrand name="MonCash" logo="/moncash.png" /><PaymentBrand name="NatCash" logo="/natcash.png" /><span className="flex items-center gap-2 text-sm font-bold"><CreditCard className="h-5 w-5 text-[#F45D2C]" />Cartes</span><span className="flex items-center gap-2 text-sm font-bold"><Globe2 className="h-5 w-5 text-[#F45D2C]" />Crypto</span></div></div></section>;
}

function ProductRail() {
  const partners = [
    { name: "SD Master", logo: "/partners/sd-master.jpg", href: "https://sd-master.com/" },
    { name: "Smartcore Express", logo: "/partners/smartcore-express.png", href: "https://smartcoreexpress.com/" },
    { name: "Tikè Fasil", logo: "/partners/tike-fasil.jpg", href: "https://www.tikefasil.com/" },
    { name: "Cash Transfe", logo: "/partners/cash-transfe.jpg", href: "https://cashtransfe.com/" },
    { name: "Smartcore Académique", logo: "/partners/smartcore-academique.jpg", href: null },
    { name: "Pay'm Plop Plop", logo: "/partners/paym-plop-plop.png", href: null },
  ];

  const logo = (partner: (typeof partners)[number], group: number) => {
    const content = (
      <span className="flex h-16 w-[190px] items-center justify-center px-4 transition-opacity hover:opacity-80 sm:w-[220px]">
        <Image src={partner.logo} alt={partner.name} width={180} height={52} className="max-h-11 w-auto max-w-[165px] object-contain sm:max-w-[190px]" />
      </span>
    );

    return partner.href ? (
      <a key={`${group}-${partner.name}`} href={partner.href} target="_blank" rel="noreferrer" aria-label={`Visiter le site de ${partner.name}`} className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F45D2C]">
        {content}
      </a>
    ) : (
      <span key={`${group}-${partner.name}`} className="shrink-0" title={partner.name}>{content}</span>
    );
  };

  return (
    <div id="partners" aria-label="Partenaires Kobara" className="overflow-hidden border-b border-[#DDD7D3] bg-white py-5">
      <div className="kobara-partner-track flex w-max">
        {[0, 1].map(group => (
          <div key={group} className="flex shrink-0 items-center gap-5 pr-5 sm:gap-7 sm:pr-7">
            <span className="w-32 shrink-0 text-center text-[10px] font-bold uppercase text-[#9D9EA3]">Partenaires Kobara</span>
            {partners.map(partner => logo(partner, group))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionIntro({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return <div className="max-w-[760px]"><p className="text-sm font-bold text-[#F45D2C]">{kicker}</p><h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.04] sm:text-5xl lg:text-[58px]">{title}</h2><p className="mt-6 max-w-[680px] text-base leading-7 text-[#5C5E66] sm:text-lg sm:leading-8">{body}</p></div>;
}

const paymentMethodRows = [
  { name: "MonCash", description: "Paiement mobile Digicel", logo: "/moncash.png" },
  { name: "NatCash", description: "Paiement mobile Natcom", logo: "/natcash.png" },
  { name: "Carte bancaire", description: "Visa, Mastercard et Amex", logo: "" },
  { name: "Crypto", description: "BTC, USDT, ETH et plus", logo: "" },
] as const;

const paymentMethodActions = [
  { name: "MonCash", enabled: false }, { name: "MonCash", enabled: true },
  { name: "NatCash", enabled: false }, { name: "NatCash", enabled: true },
  { name: "Carte bancaire", enabled: true }, { name: "Carte bancaire", enabled: false },
  { name: "Crypto", enabled: true }, { name: "Crypto", enabled: false },
] as const;

function PaymentMethodsDemo() {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(-1);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ MonCash: true, NatCash: true, "Carte bancaire": false, Crypto: false });

  useEffect(() => {
    if (reduceMotion) return;
    let interval = 0;
    const advance = () => setStep(current => {
      const next = (current + 1) % paymentMethodActions.length;
      const action = paymentMethodActions[next];
      setEnabled(values => ({ ...values, [action.name]: action.enabled }));
      return next;
    });
    const start = window.setTimeout(() => {
      advance();
      interval = window.setInterval(advance, 1700);
    }, 900);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [reduceMotion]);

  const activeRow = step < 0 ? 0 : paymentMethodRows.findIndex(item => item.name === paymentMethodActions[step].name);

  return <div className="grid overflow-hidden rounded-lg border border-[#DAD4D0] bg-white shadow-[0_24px_55px_rgba(16,19,29,0.09)] sm:grid-cols-[0.9fr_1.1fr]">
    <div className="hidden min-h-[420px] bg-[#FCF7F4] p-6 sm:block"><div className="flex items-center justify-between border-b border-[#E7E1DD] pb-5"><div className="flex items-center gap-3"><Image src="/Icone.png" alt="" width={30} height={30} className="h-8 w-8 rounded" /><div><p className="text-sm font-bold">Checkout en direct</p><p className="text-[10px] text-[#9D9EA3]">Smartcore Academy</p></div></div><span className="h-2 w-2 rounded-full bg-[#20A65A]" /></div><p className="mt-6 text-xs font-bold text-[#5C5E66]">MOYENS PROPOSÉS AU CLIENT</p><div className="mt-4 space-y-3"><AnimatePresence initial={false}>{paymentMethodRows.filter(item => enabled[item.name]).map(item => <motion.div layout key={item.name} initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: 64, y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex items-center justify-between overflow-hidden rounded-md border border-[#DDD7D3] bg-white px-4"><div><p className="text-sm font-bold">{item.name}</p><p className="mt-0.5 text-[9px] text-[#9D9EA3]">{item.description}</p></div>{item.logo ? <Image src={item.logo} alt={item.name} width={42} height={24} className="h-6 w-auto object-contain" /> : item.name === "Carte bancaire" ? <CreditCard className="h-5 w-5 text-[#315FCC]" /> : <Globe2 className="h-5 w-5 text-[#F45D2C]" />}</motion.div>)}</AnimatePresence></div></div>
    <div className="relative p-5 sm:p-6"><p className="text-sm font-bold">Moyens de paiement</p><p className="mt-1 text-[10px] leading-4 text-[#5C5E66]">Activez uniquement les options utiles à vos clients.</p><div className="mt-5">{paymentMethodRows.map((item, index) => { const isEnabled = enabled[item.name]; const isActive = index === activeRow && step >= 0; return <div key={item.name} className="flex min-h-20 items-center justify-between border-b border-[#E7E1DD] last:border-b-0"><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-[9px] text-[#9D9EA3]">{item.description}</p></div><motion.span animate={isActive ? { scale: [1, 0.88, 1] } : { scale: 1 }} transition={{ duration: 0.3 }} className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${isEnabled ? "bg-[#F45D2C]" : "bg-[#D9DDE2]"}`}><motion.span layout className={`absolute top-1 h-4 w-4 rounded-full bg-white ${isEnabled ? "right-1" : "left-1"}`} /></motion.span></div>; })}</div>{!reduceMotion && <motion.div aria-hidden animate={{ top: 91 + activeRow * 80, opacity: step < 0 ? 0 : 1, scale: step >= 0 ? [1, 0.82, 1] : 1 }} transition={{ top: { duration: 0.5, ease: "easeInOut" }, opacity: { duration: 0.2 }, scale: { duration: 0.28 } }} className="pointer-events-none absolute right-1 z-20 text-[#315FCC] drop-shadow-[0_2px_2px_rgba(255,255,255,0.95)]"><MousePointer2 className="h-7 w-7 fill-[#7DB7FF]" /></motion.div>}</div>
  </div>;
}

function ApiConsole() {
  const reduceMotion = useReducedMotion();
  const code = `const payment = await kobara.payments.create({
  amount: 2500,
  currency: "HTG",
  provider: "moncash",
  success_url: "https://store.ht/success"
});

// Redirigez vers le checkout Kobara
redirect(payment.checkout_url);`;
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const delay = typedLength >= code.length ? 2600 : 52;
    const timer = window.setTimeout(() => setTypedLength(current => current >= code.length ? 0 : current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [code.length, reduceMotion, typedLength]);

  const displayedLength = reduceMotion ? code.length : typedLength;
  return <div className="overflow-hidden rounded-lg border border-[#2A2F3B] bg-[#171B27] shadow-[0_28px_65px_rgba(16,19,29,0.18)]"><div className="flex h-12 items-center justify-between border-b border-white/10 px-4"><div className="flex gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#F45D2C]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FC9A65]" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /></div><span className="text-[10px] font-semibold text-white/40">create-payment.ts</span></div><pre aria-label="Exemple de code Kobara en cours de saisie" className="min-h-[270px] overflow-x-auto p-5 text-[11px] leading-6 text-[#D7DBE7] sm:p-7 sm:text-xs"><code>{code.slice(0, displayedLength)}{!reduceMotion && <motion.span aria-hidden animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-[#FC9A65]" />}</code></pre><div className="grid border-t border-white/10 sm:grid-cols-3">{[[Webhook, "Webhooks signés"], [KeyRound, "Clés révocables"], [FileText, "SDK documentés"]].map(([Icon, label]) => { const I = Icon as typeof Webhook; return <div key={String(label)} className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><I className="h-4 w-4 text-[#FC9A65]" /><span className="text-[11px] font-semibold text-white/65">{String(label)}</span></div>; })}</div></div>;
}

function OnlinePayments() {
  const cards = [[Link2, "Page de paiement", "Lancez un checkout complet et personnalisable sans construire l'interface."], [WalletCards, "Liens partageables", "Créez un lien, partagez-le sur WhatsApp, SMS ou vos réseaux et suivez son statut."], [Code2, "Intégration API", "Créez des paiements depuis votre application avec des réponses et erreurs prévisibles."], [Webhook, "Confirmation automatique", "Terminez chaque transaction en arrière-plan, même si le client ferme la page."]];
  return <section id="online-payments" className="py-20 sm:py-32"><div className="mx-auto max-w-[1200px] px-5 sm:px-8"><div className="grid gap-9 sm:gap-12 lg:grid-cols-[1fr_280px] lg:items-end"><SectionIntro kicker="Paiements en ligne" title="Optimisez votre expérience de paiement" body="Kobara réunit les interfaces prêtes à l'emploi, les liens partageables et les outils développeur pour vous aider à encaisser rapidement sans perdre le contrôle de votre marque." /><div className="border-l-2 border-[#F45D2C] pl-5 sm:pl-6"><p className="text-4xl font-semibold sm:text-5xl">1</p><p className="mt-2 text-xs leading-5 text-[#5C5E66] sm:text-sm sm:leading-6">intégration pour activer plusieurs moyens de paiement locaux et internationaux.</p></div></div><h3 className="mt-14 text-xl font-semibold sm:mt-20 sm:text-3xl">Plusieurs façons d&apos;accepter les paiements en ligne</h3><div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#DDD7D3] bg-[#DDD7D3] sm:mt-10">{cards.map(([Icon, title, body], index) => { const I = Icon as typeof Link2; return <article key={String(title)} className="bg-white p-4 sm:p-9"><I className="h-5 w-5 text-[#F45D2C] sm:h-6 sm:w-6" /><h4 className="mt-7 text-base font-semibold sm:mt-10 sm:text-xl">{String(title)}</h4><p className="mt-3 max-w-md text-xs leading-5 text-[#5C5E66] sm:text-sm sm:leading-6">{String(body)}</p><Link href={index < 2 ? "/register" : "https://docs.kobara.app/docs/quickstart"} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#F45D2C] sm:mt-8 sm:gap-2 sm:text-sm">Découvrir<ChevronRight className="h-4 w-4" /></Link></article>; })}</div></div></section>;
}

function PaymentMethods() {
  return <section id="payment-methods" className="border-y border-[#D9DDE2] bg-[#F4F7FA] py-24 sm:py-32"><div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr]"><div><SectionIntro kicker="Moyens de paiement" title="Affichez le bon moyen au bon client" body="Activez MonCash et NatCash par défaut, puis ajoutez les cartes ou les paiements numériques selon les besoins de votre activité. Vous gardez la maîtrise depuis votre dashboard." /><div className="mt-8 space-y-4">{["Activation simple depuis les paramètres", "Devises HTG et USD clairement séparées", "Statuts et frais visibles à chaque étape"].map(item => <div key={item} className="flex items-center gap-3 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 text-[#F45D2C]" />{item}</div>)}</div></div><PaymentMethodsDemo /></div></section>;
}

function DeveloperSection() {
  return <section id="developers" className="py-24 sm:py-32"><div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]"><div><SectionIntro kicker="Documentation et SDK" title="Une intégration centrée sur les développeurs" body="Une API cohérente, des SDK officiels et des webhooks signés vous permettent de créer un paiement, suivre son état et automatiser vos opérations avec moins de maintenance." /><div className="mt-8 flex flex-wrap gap-3"><Link href="https://docs.kobara.app/docs/quickstart" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#F45D2C] px-6 text-sm font-bold text-white">Explorer la documentation<ArrowRight className="h-4 w-4" /></Link><Link href="/dashboard/developers" className="inline-flex min-h-12 items-center rounded-full border border-[#10131D] px-6 text-sm font-bold">Voir les SDK</Link></div></div><ApiConsole /></div></section>;
}

function SecuritySection() {
  return <section id="security" className="border-y border-[#F5B293] bg-[#FBCDB1] py-16 sm:py-24"><div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-5 gap-y-9 px-5 sm:gap-10 sm:px-8 lg:grid-cols-[1.1fr_repeat(3,1fr)]"><div className="col-span-2 lg:col-span-1"><p className="text-sm font-bold text-[#E22F23]">Plateforme unifiée</p><h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight">Fiabilité, conformité et sécurité au cœur de chaque transaction.</h2></div>{[[Activity, "Suivi continu", "Les statuts restent synchronisés grâce aux webhooks et aux tâches d'arrière-plan."], [ShieldCheck, "Contrôles d'accès", "KYC, sessions sécurisées et clés révocables protègent votre espace."], [BarChart3, "Visibilité complète", "Paiements, soldes, frais et retraits restent consultables dans un même dashboard."]].map(([Icon, title, body], index) => { const I = Icon as typeof Activity; return <article key={String(title)} className={`border-l border-[#EAA786] pl-4 sm:pl-6 ${index === 2 ? "col-span-2 lg:col-span-1" : ""}`}><I className="h-5 w-5 text-[#E22F23] sm:h-6 sm:w-6" /><h3 className="mt-5 text-base font-semibold sm:mt-6 sm:text-lg">{String(title)}</h3><p className="mt-3 text-xs leading-5 text-[#5C5E66] sm:text-sm sm:leading-6">{String(body)}</p></article>; })}</div></section>;
}

export function LandingPageV2() {
  const { language } = useTranslation();
  const copy = copyByLocale[language] || copyByLocale.fr;
  return <main id="overview" className="kobara-landing min-h-screen bg-[#FCF7F4] text-[#10131D] selection:bg-[#FBCDB1]">
    <PublicHeader />
    <section className="relative overflow-hidden border-b border-[#D9DDE2] bg-[#F4F7FA]"><HomeHeroBackdrop /><motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-0 mx-auto grid max-w-[1200px] grid-cols-4 border-x border-[#D9DDE2]/70">{[0, 1, 2, 3].map(i => <span key={i} className="border-r border-[#D9DDE2]/70 last:border-r-0" />)}</motion.div><div className="relative mx-auto grid min-h-[590px] max-w-[1200px] items-center gap-14 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16"><div className="max-w-[520px]"><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.15 }} className="inline-flex items-center gap-2 rounded-full bg-[#FFF1E9] px-3 py-2 text-xs font-bold text-[#E22F23]"><span className="h-2 w-2 rounded-full bg-[#F45D2C]" />Infrastructure de paiement pour Haïti</motion.p><motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mt-8 text-balance text-[43px] font-semibold leading-[1.03] sm:text-[54px] lg:text-[56px]">{copy.title}</motion.h1><motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="mt-7 max-w-[520px] text-base leading-7 text-[#5C5E66] sm:text-lg sm:leading-8">{copy.intro}</motion.p><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-6 text-sm font-bold text-white">{copy.primary}<ArrowRight className="h-4 w-4" /></Link><Link href="https://docs.kobara.app/docs/quickstart" className="inline-flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-[#F45D2C]">{copy.secondary}<ChevronRight className="h-4 w-4" /></Link></motion.div></div><HeroPaymentDemo /></div><AnimatedTrace /></section>
    <Benefits /><TrustStrip /><ProductRail /><OnlinePayments /><PaymentMethods /><DeveloperSection /><SecuritySection />
    <section className="bg-white"><div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-20 sm:px-8 md:grid-cols-[1fr_auto]"><div><h2 className="max-w-[720px] text-4xl font-semibold leading-tight sm:text-5xl">Prêt à accepter vos premiers paiements ?</h2><p className="mt-4 max-w-2xl text-[#5C5E66]">Créez votre compte Kobara, configurez vos moyens de paiement et lancez votre premier lien.</p></div><Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#10131D] px-6 text-sm font-bold text-white">Créer mon compte<ArrowRight className="h-4 w-4" /></Link></div></section>
    <Footer />
  </main>;
}

function PaymentBrand({ name, logo }: { name: string; logo: string }) { return <div className="flex items-center gap-2"><Image src={logo} alt={name} width={50} height={30} className="h-7 w-auto object-contain" /><span className="text-sm font-bold">{name}</span></div>; }

function Brand() {
  return <Link href="/" aria-label="Accueil Kobara" className="flex items-center gap-3"><Image src="/Icone.png" alt="" width={30} height={30} className="h-7 w-7 rounded" /><span className="text-xl font-extrabold text-[#10131D]">KOBARA</span></Link>;
}

function Footer() {
  const groups = [{ title: "Produit", links: [["Paiements", "#overview"], ["Liens de paiement", "/register"], ["Tarifs", "/pricing"]] }, { title: "Développeurs", links: [["Documentation", "https://docs.kobara.app/docs/quickstart"], ["SDK", "/dashboard/developers"], ["Webhooks", "https://docs.kobara.app/docs/webhooks"]] }, { title: "Entreprise", links: [["Contact", "/contact"], ["Programme Developer", "/developer"], ["Programme Ambassadeur", "/partnership/ambassador"], ["Confidentialité", "/privacy"], ["Conditions", "/terms"]] }];
  return <footer className="border-t border-[#DDD7D3] bg-[#FCF7F4]"><div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12"><div className="grid grid-cols-2 gap-x-6 gap-y-9 border-b border-[#DDD7D3] pb-10 sm:gap-10 sm:pb-12 lg:grid-cols-[1.5fr_repeat(3,1fr)]"><div className="col-span-2 lg:col-span-1"><Brand /><p className="mt-4 max-w-sm text-xs leading-5 text-[#5C5E66] sm:mt-5 sm:text-sm sm:leading-6">Infrastructure de paiement moderne pour les entreprises, plateformes et développeurs en Haïti.</p></div>{groups.map((group, index) => <div key={group.title} className={index === 2 ? "col-span-2 lg:col-span-1" : ""}><h3 className="text-xs font-bold">{group.title}</h3><ul className={`mt-4 gap-x-5 gap-y-2 sm:mt-5 ${index === 2 ? "grid grid-cols-3 lg:block lg:space-y-3" : "space-y-2 sm:space-y-3"}`}>{group.links.map(([label, href]) => <li key={label}><Link href={href} className="text-xs text-[#5C5E66] hover:text-[#F45D2C] sm:text-sm">{label}</Link></li>)}</ul></div>)}</div><div className="flex flex-col gap-4 pt-6 text-[11px] text-[#5C5E66] sm:flex-row sm:items-center sm:justify-between sm:pt-7 sm:text-xs"><span>© {new Date().getFullYear()} Kobara. Tous droits réservés.</span><div className="flex items-center justify-between gap-4 sm:justify-start"><span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#F45D2C]" />Paiements sécurisés</span><LanguageSwitcher /></div></div></div></footer>;
}
