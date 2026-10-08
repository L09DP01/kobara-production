"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Globe2,
  Link2,
  MessageCircle,
  MousePointer2,
  Send,
  ShieldCheck,
  Store,
  type LucideIcon,
  UserRound,
  Webhook,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ProductHeroKind = "payments" | "checkout" | "payment-links" | "qr-codes" | "invoices" | "payment-methods" | "sdk";

function useDemoStep(count: number, interval: number) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % count), interval);
    return () => window.clearInterval(timer);
  }, [count, interval, reduceMotion]);

  return { step, reduceMotion: Boolean(reduceMotion) };
}

const shell = "relative mx-auto min-h-[420px] w-full max-w-[620px] overflow-hidden rounded-md border border-[#D8DDE5] bg-white shadow-[0_26px_70px_rgba(16,19,29,0.14)]";

export function ProductHeroVisual({ kind }: { kind: ProductHeroKind }) {
  const reduceMotion = useReducedMotion();
  const isStorysetVisual = true;
  let visual = <PaymentMethodsStoryset />;

  if (kind === "payments") visual = <PaymentsStoryset />;
  if (kind === "checkout") visual = <CheckoutStoryset />;
  if (kind === "payment-links") visual = <PaymentLinksStoryset />;
  if (kind === "qr-codes") visual = <QrPaymentFlow />;
  if (kind === "invoices") visual = <InvoiceStoryset />;
  if (kind === "sdk") visual = <SdkStoryset />;

  return (
    <div className={`relative mx-auto w-full max-w-[650px] ${isStorysetVisual ? "px-0 pb-0" : "px-1 pb-5 sm:px-4 sm:pb-8"}`}>
      {!isStorysetVisual && <div aria-hidden className="absolute inset-x-8 bottom-1 top-6 rotate-[1.8deg] rounded-md border border-[#F5B293] bg-[#FBCDB1] opacity-70 sm:inset-x-11" />}
      {!isStorysetVisual && <div aria-hidden className="absolute inset-x-5 bottom-3 top-3 -rotate-[1deg] rounded-md border border-[#C9D3E2] bg-[#E8EEF7] sm:inset-x-8" />}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, -4, 0], scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.45 }, scale: { duration: 0.5 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        className="relative z-10"
      >
        {visual}
      </motion.div>
    </div>
  );
}

function PaymentsStoryset() {
  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="relative overflow-hidden bg-transparent">
        <div aria-hidden className="absolute bottom-[7%] left-1/2 h-10 w-[58%] -translate-x-1/2 rounded-[50%] bg-[#10131D]/9 blur-xl" />
        <Image
          src="/illustrations/online-transactions-storyset.svg"
          alt="Illustration animée de transactions en ligne"
          width={500}
          height={500}
          priority
          unoptimized
          className="relative z-10 mx-auto h-auto w-full max-w-[520px] object-contain [filter:drop-shadow(0_18px_22px_rgba(16,19,29,0.10))]"
        />
      </div>
      <a href="https://storyset.com/online" target="_blank" rel="noreferrer" className="sr-only">
        Online illustrations by Storyset
      </a>
    </div>
  );
}

function CheckoutStoryset() {
  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="relative overflow-hidden bg-transparent">
        <div aria-hidden className="absolute bottom-[7%] left-1/2 h-10 w-[58%] -translate-x-1/2 rounded-[50%] bg-[#10131D]/9 blur-xl" />
        <Image
          src="/illustrations/successful-purchase-storyset.svg"
          alt="Illustration animée d’un achat confirmé"
          width={500}
          height={500}
          priority
          unoptimized
          className="relative z-10 mx-auto h-auto w-full max-w-[520px] object-contain [filter:drop-shadow(0_18px_22px_rgba(16,19,29,0.10))]"
        />
      </div>
      <a href="https://storyset.com/online" target="_blank" rel="noreferrer" className="sr-only">
        Online illustrations by Storyset
      </a>
    </div>
  );
}

function PaymentLinksStoryset() {
  return <StorysetIllustration src="/illustrations/share-link-storyset.svg" alt="Illustration animée du partage d’un lien de paiement" />;
}

function InvoiceStoryset() {
  return <StorysetIllustration src="/illustrations/invoice-storyset.svg" alt="Illustration animée d’une facture Kobara" />;
}

function PaymentMethodsStoryset() {
  const reduceMotion = useReducedMotion();
  const paymentMethods = [
    { name: "MonCash", src: "/moncash.png", angle: 0, imageClass: "h-5 w-11 sm:h-6 sm:w-12" },
    { name: "NatCash", src: "/natcash.png", angle: 72, imageClass: "h-5 w-11 sm:h-6 sm:w-12" },
    { name: "Cartes", src: "/payment-brands/mastercard.svg", angle: 144, imageClass: "h-6 w-9 sm:h-7 sm:w-10" },
    { name: "PayPal", src: "/payment-brands/paypal.svg", angle: 216, imageClass: "h-6 w-6 sm:h-7 sm:w-7" },
    { name: "Crypto", src: "/crypto/btc.png", angle: 288, imageClass: "h-6 w-6 sm:h-7 sm:w-7" },
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px]">
      <div aria-hidden className="pointer-events-none absolute inset-[11%] z-20 rounded-full border border-dashed border-[#F45D2C]/25 sm:inset-[8%]">
        {paymentMethods.map((method) => (
          <motion.div
            key={method.name}
            className="absolute inset-0 will-change-transform"
            initial={{ rotate: method.angle }}
            animate={{ rotate: reduceMotion ? method.angle : method.angle + 360 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 24, ease: "linear", repeat: Infinity }}
          >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ rotate: -method.angle }}
                animate={{ rotate: reduceMotion ? -method.angle : -method.angle - 360 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 24, ease: "linear", repeat: Infinity }}
                className="flex h-10 w-14 items-center justify-center rounded-md border border-[#E1DAD6] bg-white px-1.5 shadow-[0_10px_24px_rgba(16,19,29,0.14)] sm:h-12 sm:w-16"
                title={method.name}
              >
                <Image src={method.src} alt="" width={64} height={32} unoptimized className={`object-contain ${method.imageClass}`} />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="relative z-10">
        <StorysetIllustration src="/illustrations/payment-methods-storyset.svg" alt="Illustration animée des moyens de paiement" />
      </div>
    </div>
  );
}

function SdkStoryset() {
  return <StorysetIllustration src="/illustrations/programmer-storyset.svg" alt="Illustration animée de l’intégration SDK Kobara" />;
}

function StorysetIllustration({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="relative overflow-hidden bg-transparent">
        <div aria-hidden className="absolute bottom-[7%] left-1/2 h-10 w-[58%] -translate-x-1/2 rounded-[50%] bg-[#10131D]/9 blur-xl" />
        <Image
          src={src}
          alt={alt}
          width={500}
          height={500}
          priority
          unoptimized
          className="relative z-10 mx-auto h-auto w-full max-w-[520px] object-contain [filter:drop-shadow(0_18px_22px_rgba(16,19,29,0.10))]"
        />
      </div>
      <a href="https://storyset.com/online" target="_blank" rel="noreferrer" className="sr-only">
        Online illustrations by Storyset
      </a>
    </div>
  );
}

function WindowHeader({ label }: { label: string }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-[#E1E4E8] bg-white px-4">
      <div className="flex items-center gap-2"><Image src="/Icone.png" alt="" width={20} height={20} /><strong className="text-xs">{label}</strong></div>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#5C5E66]"><ShieldCheck className="h-3.5 w-3.5 text-[#F45D2C]" />Sécurisé</span>
    </div>
  );
}

function PhoneMockup({ children, className = "w-[180px]" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[210/430] shrink-0 rounded-[38px] bg-[linear-gradient(145deg,#555E6B_0%,#11151C_28%,#020409_70%,#69717D_100%)] p-[7px] shadow-[0_24px_50px_rgba(16,19,29,0.28),inset_0_0_0_1px_rgba(255,255,255,0.22)] ${className}`}>
      <div className="relative h-full overflow-hidden rounded-[31px] bg-white">
        {children}
      </div>
      <svg aria-hidden viewBox="0 0 210 430" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="phone-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E7EBF0" stopOpacity="0.9" />
            <stop offset="0.28" stopColor="#69717D" stopOpacity="0.25" />
            <stop offset="0.72" stopColor="#05070B" stopOpacity="0.9" />
            <stop offset="1" stopColor="#CDD3DA" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <rect x="2.5" y="2.5" width="205" height="425" rx="39" fill="none" stroke="url(#phone-edge)" strokeWidth="3" />
        <rect x="73" y="12" width="64" height="19" rx="9.5" fill="#05070B" />
        <circle cx="126" cy="21.5" r="3" fill="#26344D" />
        <path d="M4 92v38M4 147v58M206 126v72" stroke="#747C88" strokeWidth="4" strokeLinecap="round" />
        <path d="M16 34C30 14 46 9 70 7" fill="none" stroke="white" strokeOpacity="0.33" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PaymentsFlow() {
  const { step, reduceMotion } = useDemoStep(5, 1300);
  const events = ["Paiement créé", "Vérification du moyen", "Traitement", "Webhook envoyé", "Confirmé"];
  return (
    <div className={`${shell} bg-[#F5F7FA]`}>
      <WindowHeader label="Transaction en direct" />
      <div className="min-h-[368px] p-4 sm:p-6">
        <div className="flex items-start justify-between rounded-md border border-[#D8DDE5] bg-white p-4">
          <div><p className="text-[9px] font-bold uppercase text-[#69707D]">Identifiant du paiement</p><p className="mt-1 font-mono text-[10px] font-bold sm:text-xs">pay_9a8b7c6d5e4f</p></div>
          <motion.span key={step} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`rounded px-2 py-1 text-[9px] font-bold ${step === 4 ? "bg-[#E9F8F2] text-[#087A55]" : "bg-[#FFF1E9] text-[#8A321F]"}`}>{step === 4 ? "Confirmé" : "En traitement"}</motion.span>
        </div>

        <div className="relative mt-4 grid grid-cols-[1fr_68px_1fr] items-center gap-2 sm:grid-cols-[1fr_90px_1fr]">
          <FlowNode icon={UserRound} label="Client" detail="2 500 HTG" sub="MonCash •••• 5967" />
          <div className="relative flex h-full items-center justify-center">
            <div className="absolute left-0 right-0 h-px bg-[#CBD2DC]" />
            <motion.div aria-hidden animate={reduceMotion ? { x: 20 } : { x: [-28, 28] }} transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} className="z-10 h-2.5 w-2.5 rounded-full bg-[#F45D2C] shadow-[0_0_0_6px_rgba(244,93,44,0.14)]" />
          </div>
          <motion.div animate={step === 4 && !reduceMotion ? { scale: [1, 1.025, 1] } : undefined}>
            <FlowNode icon={Store} label="Smartcore Academy" detail={step === 4 ? "+ 2 500 HTG" : "En attente"} sub={step === 4 ? "Solde mis à jour" : "Confirmation en cours"} success={step === 4} />
          </motion.div>
        </div>

        <div className="mt-4 rounded-md border border-[#D8DDE5] bg-white px-4 py-3">
          <div className="flex items-center justify-between"><strong className="text-[10px]">Journal de la transaction</strong><span className="text-[9px] text-[#69707D]">Aujourd’hui, 14:32</span></div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {events.map((event, index) => <div key={event} className="min-w-0"><motion.div animate={{ backgroundColor: index <= step ? "#F45D2C" : "#DCE1E8" }} className="h-1 rounded-full" /><p className={`mt-2 hidden text-[8px] leading-tight sm:block ${index <= step ? "font-bold text-[#10131D]" : "text-[#89909B]"}`}>{event}</p></div>)}
          </div>
          <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-[9px] font-semibold text-[#5C5E66]">{step === 3 ? <Webhook className="h-3.5 w-3.5 text-[#315FCC]" /> : step === 4 ? <CheckCircle2 className="h-3.5 w-3.5 text-[#087A55]" /> : <Clock3 className="h-3.5 w-3.5 text-[#F45D2C]" />}{events[step]}{step === 3 && " • payment.succeeded"}{step === 4 && " • commande ORD-12345"}</motion.div></AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ icon: Icon, label, detail, sub, success }: { icon: LucideIcon; label: string; detail: string; sub: string; success?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-[#D8DDE5] bg-white p-3 text-center sm:p-5">
      <Icon className="mx-auto h-5 w-5 text-[#F45D2C]" />
      <p className="mt-3 text-[10px] font-bold uppercase text-[#69707D]">{label}</p>
      <p className="mt-2 text-xs font-extrabold sm:text-base">{detail}</p>
      <p className={`mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold ${success ? "text-[#087A55]" : "text-[#69707D]"}`}>{success && <CheckCircle2 className="h-3.5 w-3.5" />}{sub}</p>
    </div>
  );
}

const checkoutMethods = [
  { name: "MonCash", detail: "Paiement mobile Digicel", logo: "/moncash.png", action: "Payer avec MonCash", tone: "#E22F23" },
  { name: "NatCash", detail: "Paiement mobile Natcom", logo: "/natcash.png", action: "Payer avec NatCash", tone: "#F45D2C" },
  { name: "Crypto", detail: "BTC, USDT, ETH et plus", logo: "", action: "Choisir une crypto", tone: "#315FCC" },
  { name: "Carte bancaire*", detail: "Visa et Mastercard", logo: "", action: "Continuer par carte", tone: "#10131D" },
];

function CheckoutCycle() {
  const { step, reduceMotion } = useDemoStep(checkoutMethods.length, 2400);
  const selected = checkoutMethods[step];
  return (
    <div className={shell}>
      <WindowHeader label="Smartcore Academy" />
      <div className="grid min-h-[368px] md:grid-cols-[1fr_170px]">
        <div className="relative p-4 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-sm font-bold">Choisissez votre moyen de paiement</p><p className="mt-1 text-[9px] text-[#777E89]">Réf. pay_9a8b7c6d5e4f</p></div><span className="hidden items-center gap-1 text-[9px] font-semibold text-[#087A55] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#18A772]" />Session sécurisée</span></div>
          <div className="mt-4 space-y-2">
            {checkoutMethods.map((method, index) => (
              <motion.div key={method.name} animate={index === step && !reduceMotion ? { scale: [1, 0.985, 1] } : { scale: 1 }} className={`flex min-h-[54px] items-center justify-between rounded-md border px-3 py-2.5 ${index === step ? "border-[#F45D2C] bg-[#FFF7F3] shadow-[0_0_0_1px_rgba(244,93,44,0.08)]" : "border-[#E1E4E8] bg-white"}`}>
                <div className="flex items-center gap-3"><span className={`h-4 w-4 rounded-full border ${index === step ? "border-[5px] border-[#F45D2C]" : "border-[#A8AFBA]"}`} /><div><strong className="block text-xs">{method.name}</strong><span className="text-[9px] text-[#777E89]">{method.detail}</span></div></div>
                {method.logo ? <Image src={method.logo} alt="" width={42} height={24} className="h-5 w-auto object-contain" /> : index === 2 ? <Globe2 className="h-5 w-5 text-[#315FCC]" /> : <CreditCard className="h-5 w-5 text-[#333847]" />}
              </motion.div>
            ))}
          </div>
          <AnimatePresence mode="wait"><motion.button key={selected.action} initial={{ opacity: 0.65 }} animate={{ opacity: 1 }} exit={{ opacity: 0.65 }} type="button" style={{ backgroundColor: selected.tone, color: "#FFFFFF" }} className="kobara-cta mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-xs font-bold text-white"><span style={{ color: "#FFFFFF" }}>{selected.action}</span><ArrowRight className="h-3.5 w-3.5" /></motion.button></AnimatePresence>
          {!reduceMotion && <motion.div aria-hidden animate={{ top: `${112 + step * 62}px`, left: ["88%", "82%", "88%"] }} transition={{ top: { duration: 0.45, ease: "easeInOut" }, left: { duration: 0.5 } }} className="pointer-events-none absolute z-20 hidden text-[#315FCC] drop-shadow-[0_2px_1px_white] sm:block"><MousePointer2 className="h-6 w-6 fill-[#86B8FF]" /></motion.div>}
        </div>
        <aside className="hidden border-l border-[#E1E4E8] bg-[#FFF9F6] p-5 md:block"><span className="text-[10px] font-bold text-[#69707D]">DÉTAILS</span><p className="mt-1 text-[9px] text-[#69707D]">Lien de paiement</p><p className="mt-5 text-2xl font-extrabold">2 500 <small className="text-xs text-[#F45D2C]">HTG</small></p><div className="mt-6 space-y-3 border-t border-[#E1E4E8] pt-4 text-[9px]"><div className="flex justify-between gap-2"><span className="text-[#69707D]">Article</span><strong>Formation Pro</strong></div><div className="flex justify-between"><span className="text-[#69707D]">Quantité</span><strong>1</strong></div><div className="flex justify-between"><span className="text-[#69707D]">Total</span><strong>2 500 HTG</strong></div></div><div className="mt-7 flex items-center gap-2 text-[9px] font-semibold text-[#5C5E66]"><motion.span animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-[#F45D2C]" />Confirmation en temps réel</div><p className="mt-5 text-[8px] leading-4 text-[#89909B]">* Affiché uniquement si activé sur le compte.</p></aside>
      </div>
    </div>
  );
}

function PaymentLinkFlow() {
  const { step, reduceMotion } = useDemoStep(6, 1400);
  return (
    <div className={`${shell} bg-[#F7F9FC]`}>
      <WindowHeader label="Créer un lien de paiement" />
      <div className="grid min-h-[368px] gap-4 p-4 sm:grid-cols-[1fr_0.9fr] sm:p-6">
        <div className="rounded-md border border-[#D8DDE5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><strong className="text-xs">Nouveau lien</strong><span className="rounded bg-[#F2F4F7] px-2 py-1 text-[8px] font-bold text-[#69707D]">HTG</span></div>
          <label className="mt-4 block text-[9px] font-bold text-[#69707D]">Montant</label><div className="mt-1.5 flex h-10 items-center justify-between rounded-md border border-[#D8DDE5] px-3 text-xs font-bold"><span>{step >= 1 ? "2 500" : "0"}</span><span className="text-[9px] text-[#69707D]">HTG</span></div>
          <label className="mt-3 block text-[9px] font-bold text-[#69707D]">Description</label><div className="mt-1.5 h-10 rounded-md border border-[#D8DDE5] px-3 py-2.5 text-[10px]">{step >= 1 ? "Commande #2048" : "Ex. Commande client"}</div>
          <motion.button animate={step === 2 && !reduceMotion ? { scale: [1, 0.97, 1] } : undefined} type="button" style={{ color: "#FFFFFF" }} className="kobara-cta mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F45D2C] text-[10px] font-bold text-white">Créer le lien<Link2 className="h-3.5 w-3.5" /></motion.button>
          <AnimatePresence>{step >= 2 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-md border border-[#F5B293] bg-[#FFF7F3] p-3"><div className="flex items-center justify-between text-[9px] font-bold"><span className="truncate">pay.kobara.app/pay/84K2Q</span><Copy className="h-3.5 w-3.5 text-[#F45D2C]" /></div><div className="mt-2 flex gap-2"><span className="rounded bg-white px-2 py-1 text-[8px] font-semibold text-[#168B62]">WhatsApp</span><span className="rounded bg-white px-2 py-1 text-[8px] font-semibold">SMS</span><span className="rounded bg-white px-2 py-1 text-[8px] font-semibold">E-mail</span></div></motion.div>}</AnimatePresence>
        </div>
        <div className="relative flex min-h-64 items-center justify-center">
          <PhoneMockup className="w-[176px]">
            <div className="h-full bg-[#EDF1F3] px-3 pb-3 pt-10">
              <div className="flex items-center gap-2 border-b border-[#D8DDE5] pb-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#F45D2C] text-[8px] font-black text-white">SA</span><div><strong className="block text-[8px]">Smartcore Academy</strong><span className="block text-[6px] text-[#69707D]">en ligne</span></div></div>
              <div className="mt-4 rounded-[8px_8px_8px_2px] bg-[#DDF5E7] p-3 text-[8px] shadow-sm"><div className="flex items-center gap-1.5 font-bold"><MessageCircle className="h-3 w-3 text-[#168B62]" />Paiement</div><span className="mt-2 block">Voici votre lien de paiement 👇</span><span className="mt-1.5 block break-all font-bold text-[#315FCC]">pay.kobara.app/pay/84K2Q</span><span className="mt-2 block text-right text-[6px] text-[#69707D]">14:32 ✓✓</span></div>
              <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-md border border-[#E1E4E8] bg-white p-3 text-center text-[8px] font-bold shadow-sm">{step < 3 ? "Message envoyé" : step === 3 ? <span className="flex items-center justify-center gap-1.5"><ExternalLink className="h-3 w-3" />Checkout ouvert</span> : step === 4 ? "Confirmation en cours…" : <span className="text-[#087A55]">Paiement reçu ✓</span>}</motion.div></AnimatePresence>
            </div>
          </PhoneMockup>
          {step === 2 && <motion.div aria-hidden initial={{ x: -90, y: 35, opacity: 0 }} animate={{ x: 5, y: -20, opacity: [0, 1, 0] }} className="absolute text-[#F45D2C]"><Send className="h-6 w-6" /></motion.div>}
          {step === 5 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ color: "#FFFFFF" }} className="kobara-cta absolute bottom-0 right-0 flex items-center gap-2 rounded-md bg-[#10131D] px-3 py-2 text-[8px] font-bold text-white"><Bell className="h-3 w-3 text-[#FC9A65]" />+ 2 500 HTG reçu</motion.div>}
        </div>
      </div>
    </div>
  );
}

function QrPaymentFlow() {
  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="relative overflow-hidden bg-transparent">
        <div aria-hidden className="absolute bottom-[6%] left-1/2 h-10 w-[56%] -translate-x-1/2 rounded-[50%] bg-[#10131D]/9 blur-xl" />
        <Image
          src="/illustrations/mobile-payments-storyset.svg"
          alt="Illustration animée d’un paiement mobile"
          width={500}
          height={500}
          priority
          unoptimized
          className="relative z-10 mx-auto h-auto w-full max-w-[500px] object-contain [filter:drop-shadow(0_18px_22px_rgba(16,19,29,0.10))]"
        />
      </div>
      <a
        href="https://storyset.com/app"
        target="_blank"
        rel="noreferrer"
        className="sr-only"
      >
        App illustrations by Storyset
      </a>
    </div>
  );
}

function InvoiceFlow() {
  const { step, reduceMotion } = useDemoStep(6, 1400);
  const status = step < 2 ? "Brouillon" : step === 2 ? "Envoyée" : step === 3 ? "Consultée" : step === 4 ? "Paiement en cours" : "Payée";
  return (
    <div className={`${shell} bg-[#F7F9FC]`}>
      <WindowHeader label="Factures Kobara" />
      <div className="grid min-h-[368px] gap-4 p-4 sm:grid-cols-[1.2fr_0.8fr] sm:p-6">
        <div className="rounded-md border border-[#D8DDE5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#F45D2C]" /><div><strong className="block text-xs">Facture KBR-2048</strong><span className="text-[8px] text-[#69707D]">Créée le 25 sept. 2026</span></div></div><motion.span key={status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded px-2 py-1 text-[8px] font-bold ${status === "Payée" ? "bg-[#E9F8F2] text-[#087A55]" : "bg-[#FFF1E9] text-[#8A321F]"}`}>{status}{status === "Payée" && " ✓"}</motion.span></div>
          <div className="mt-5 space-y-3 text-[10px]"><InvoiceRow label="Client" value={step >= 1 ? "Jean Pierre" : ""} /><InvoiceRow label="E-mail" value={step >= 1 ? "jean@exemple.com" : ""} /><InvoiceRow label="Montant" value={step >= 1 ? "7 500 HTG" : ""} /><InvoiceRow label="Échéance" value={step >= 1 ? "30 septembre" : ""} /></div>
          <motion.button animate={step === 2 && !reduceMotion ? { scale: [1, 0.97, 1] } : undefined} type="button" style={{ color: "#FFFFFF" }} className="kobara-cta mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F45D2C] text-[10px] font-bold text-white">{step >= 2 ? "Facture envoyée" : "Envoyer la facture"}{step >= 2 ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}</motion.button>
        </div>
        <div className="flex items-center justify-center">
          <PhoneMockup className="w-[158px]">
            <div className="h-full bg-white px-3 pb-3 pt-11 text-center"><div className="flex items-center justify-center gap-1.5"><Image src="/Icone.png" alt="" width={17} height={17} /><strong className="text-[9px]">Kobara</strong></div><p className="mt-4 text-[8px] text-[#69707D]">Facture de Smartcore Academy</p><strong className="mt-2 block text-sm">7 500 HTG</strong><p className="mt-1 text-[8px] text-[#69707D]">Échéance 30 sept.</p><motion.button animate={step === 4 && !reduceMotion ? { scale: [1, 0.95, 1] } : undefined} type="button" className={`mt-5 min-h-9 w-full rounded-md text-[8px] font-bold ${step === 5 ? "bg-[#E9F8F2] text-[#087A55]" : "bg-[#FFF1E9] text-[#8A321F]"}`}>{step === 5 ? "Payée ✓" : step === 4 ? "Traitement…" : "Payer maintenant"}</motion.button><p className="mt-4 flex items-center justify-center gap-1 text-[7px] text-[#69707D]"><ShieldCheck className="h-2.5 w-2.5 text-[#F45D2C]" />Paiement sécurisé</p></div>
          </PhoneMockup>
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-8 items-center justify-between border-b border-[#E8EAEE] pb-2"><span className="text-[#69707D]">{label}</span><motion.strong key={value} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{value || "—"}</motion.strong></div>;
}

const methodNodes = [
  { name: "MonCash", note: "HTG", icon: "/moncash.png", className: "left-[5%] top-[18%]" },
  { name: "NatCash", note: "HTG", icon: "/natcash.png", className: "left-[3%] bottom-[16%]" },
  { name: "Crypto", note: "USD", icon: "crypto", className: "right-[5%] top-[17%]" },
  { name: "Cartes*", note: "HTG / USD", icon: "card", className: "right-[2%] bottom-[17%]" },
  { name: "PayPal*", note: "USD", icon: "paypal", className: "left-1/2 top-[5%] -translate-x-1/2" },
];

function PaymentMethodsFlow() {
  const { step, reduceMotion } = useDemoStep(methodNodes.length, 1450);
  return (
    <div className={`${shell} bg-[#F7F9FC]`}>
      <WindowHeader label="Moyens de paiement" />
      <div className="relative min-h-[368px]">
        <div aria-hidden className="absolute inset-[14%] rounded-[50%] border border-dashed border-[#F5B293]" />
        {methodNodes.map((method, index) => (
          <motion.div key={method.name} initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: index === step ? 1.06 : 1, borderColor: index === step ? "#F45D2C" : "#D8DDE5" }} transition={{ duration: 0.35 }} className={`absolute z-10 flex h-14 min-w-24 items-center justify-center gap-2 rounded-md border bg-white px-3 shadow-sm ${method.className}`}>
            {method.icon.startsWith("/") ? <Image src={method.icon} alt="" width={34} height={20} className="h-5 w-auto object-contain" /> : method.icon === "crypto" ? <Globe2 className="h-4 w-4 text-[#315FCC]" /> : method.icon === "card" ? <CreditCard className="h-4 w-4 text-[#F45D2C]" /> : <span className="font-black text-[#315FCC]">P</span>}
            <span><strong className="block text-[9px]">{method.name}</strong><span className="block text-[7px] text-[#69707D]">{method.note}</span></span>
          </motion.div>
        ))}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center"><motion.div animate={reduceMotion ? undefined : { boxShadow: ["0 0 0 0 rgba(244,93,44,0)", "0 0 0 12px rgba(244,93,44,0.12)", "0 0 0 0 rgba(244,93,44,0)"] }} transition={{ duration: 3.5, repeat: Infinity }} className="grid h-24 w-24 place-items-center rounded-full border border-[#F5B293] bg-white"><div><Image src="/Icone.png" alt="Kobara" width={38} height={38} className="mx-auto" /><span className="mt-1 block text-[8px] font-bold">UNE API</span></div></motion.div><motion.div key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-md bg-[#FFF1E9] px-3 py-2 text-[9px] font-bold text-[#8A321F]">{methodNodes[step].name} → Checkout</motion.div></div>
        {!reduceMotion && <motion.div aria-hidden animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} className="absolute inset-[18%] rounded-full border-t-2 border-[#F45D2C]/60" />}
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-[#69707D]">* selon disponibilité et activation</p>
      </div>
    </div>
  );
}
