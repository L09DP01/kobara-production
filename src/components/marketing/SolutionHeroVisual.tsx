"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

const solutionIllustrations: Record<string, { src: string; alt: string }> = {
  woocommerce: {
    src: "/illustrations/solution-woocommerce-storyset.svg",
    alt: "Illustration animée d’une intégration WooCommerce",
  },
  "mobile-apps": {
    src: "/illustrations/solution-mobile-apps-storyset.svg",
    alt: "Illustration animée d’un paiement dans une application mobile",
  },
  saas: {
    src: "/illustrations/solution-saas-storyset.svg",
    alt: "Illustration animée d’une infrastructure SaaS connectée à Kobara",
  },
  ecommerce: {
    src: "/illustrations/solution-ecommerce-storyset.svg",
    alt: "Illustration animée d’un checkout e-commerce",
  },
  "small-business": {
    src: "/illustrations/solution-small-business-storyset.svg",
    alt: "Illustration animée d’un paiement pour petite entreprise",
  },
  marketplaces: {
    src: "/illustrations/solution-marketplaces-storyset.svg",
    alt: "Illustration animée d’une marketplace connectée à Kobara",
  },
  agencies: {
    src: "/illustrations/solution-agencies-storyset.svg",
    alt: "Illustration animée d’une agence gérant ses intégrations",
  },
  creators: {
    src: "/illustrations/solution-creators-storyset.svg",
    alt: "Illustration animée d’un créateur recevant un paiement",
  },
};

export function SolutionHeroVisual({ slug }: { slug: string }) {
  const reduceMotion = useReducedMotion();
  const illustration = solutionIllustrations[slug];

  if (!illustration) return null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, -4, 0], scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.45 }, x: { duration: 0.55 }, scale: { duration: 0.55 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      className="relative mx-auto aspect-square w-full max-w-[600px]"
    >
      <div aria-hidden className="absolute bottom-[8%] left-1/2 h-10 w-[60%] -translate-x-1/2 rounded-[50%] bg-[#10131D]/10 blur-xl" />
      <Image
        src={illustration.src}
        alt={illustration.alt}
        width={500}
        height={500}
        priority
        unoptimized
        className="relative z-10 h-full w-full object-contain [filter:drop-shadow(0_18px_22px_rgba(16,19,29,0.10))]"
      />
      <a href="https://storyset.com/online" target="_blank" rel="noreferrer" className="sr-only">
        Online illustrations by Storyset
      </a>
    </motion.div>
  );
}
