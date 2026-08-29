"use client";

import { motion } from "framer-motion";
import { Webhook, Cpu, Layers } from "lucide-react";

const features = [
  {
    icon: <Cpu className="w-6 h-6 text-kobara-primary" />,
    title: "Payments API",
    description: "RESTful endpoints designed to be intuitive and fast for any platform.",
    code: "POST /v1/charges"
  },
  {
    icon: <Webhook className="w-6 h-6 text-kobara-primary" />,
    title: "Webhooks",
    description: "Real-time notifications for transaction state changes and events.",
    code: "EVENT charge.succeeded"
  },
  {
    icon: <Layers className="w-6 h-6 text-kobara-primary" />,
    title: "SDKs",
    description: "Libraries for your favorite languages: Node.js, Python, PHP, and more.",
    code: "npm install kobara-js"
  }
];

export function ApiFeatures() {
  return (
    <section className="py-32">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Infrastructure</h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-kobara-primary">Built for scale and speed</h3>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="bg-white rounded-3xl p-6 md:p-10 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(11,19,36,0.08)] transition-all duration-300 group"
            >
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-kobara-orange/10 group-hover:scale-110 transition-all duration-300">
                {feature.icon}
              </div>
              <h4 className="text-2xl font-bold text-kobara-primary mb-4">{feature.title}</h4>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                {feature.description}
              </p>
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 border border-white/10 shadow-inner group-hover:border-kobara-orange/30 transition-colors">
                <span className="text-kobara-orange">$</span> {feature.code}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
