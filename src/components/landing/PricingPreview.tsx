"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn, getDashboardUrl } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "0",
    description: "Perfect for side projects and small experiments.",
    features: ["Up to 100 transactions/mo", "Standard Dashboard", "Basic Webhooks", "Community Support"],
    button: "Get Started",
    highlight: false
  },
  {
    name: "Pro",
    price: "49",
    description: "Scale your business with advanced tools and higher limits.",
    features: ["Unlimited transactions", "Priority API Access", "Advanced Webhooks", "Custom Reports", "Email Support"],
    button: "Scale Now",
    highlight: true
  },
  {
    name: "Business",
    price: "Custom",
    description: "Bespoke infrastructure for high-volume enterprises.",
    features: ["Dedicated Account Manager", "99.99% Uptime SLA", "Custom Integrations", "Direct Engineer Support"],
    button: "Contact Sales",
    highlight: false
  }
];

export function PricingPreview() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Pricing</h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-kobara-primary mb-6">Simple pricing, no hidden fees</h3>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
            Choose the plan that fits your growth. Every plan includes our 2.9% transaction fee.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative flex flex-col p-6 md:p-10 rounded-[2.5rem] border transition-all duration-500 ${
                plan.highlight 
                ? "bg-slate-900 text-white border-white/10 shadow-[0_32px_64px_rgba(11,19,36,0.15)] md:scale-105 z-10" 
                : "bg-white text-kobara-primary border-slate-100 shadow-sm hover:shadow-xl"
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-kobara-red to-kobara-orange text-white text-[10px] font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">$</span>
                  <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                  {plan.price !== "Custom" && <span className="text-slate-500 font-medium">/mo</span>}
                </div>
                <p className={`mt-4 text-sm font-medium leading-relaxed ${plan.highlight ? "text-slate-400" : "text-slate-500"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${plan.highlight ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-bold tracking-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <Link 
                href={getDashboardUrl('/register')}
                className={cn(
                  buttonVariants({ variant: plan.highlight ? "default" : "outline" }),
                  "h-14 rounded-2xl font-bold text-base transition-all active:scale-95",
                  plan.highlight 
                  ? "bg-white text-slate-900 hover:bg-slate-100 shadow-xl" 
                  : "bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {plan.button}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
