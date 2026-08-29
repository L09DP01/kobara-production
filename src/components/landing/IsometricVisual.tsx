"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function IsometricVisual() {
  return (
    <div className="relative w-full h-full flex items-center justify-center lg:justify-end">
      {/* Background Glow */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute w-[90%] h-[90%] bg-gradient-radial from-kobara-red/20 to-transparent blur-[80px]" 
      />

      {/* Main Image Visual */}
      <motion.div 
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-full max-w-[720px] aspect-[4/3] drop-shadow-[0_20px_50px_rgba(7,20,43,0.1)]"
      >
        <div className="relative w-full h-full [mask-image:radial-gradient(ellipse_at_center,black_95%,transparent_100%)]">
           <Image 
              src="/images/isometric.png" 
              alt="Kobara Infrastructure" 
              fill
              className="object-contain"
              priority
           />
        </div>

        {/* Data lines animation simulated with blurred particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: "0%", y: "50%", opacity: 0 }}
              animate={{ 
                x: ["10%", "90%"],
                opacity: [0, 1, 0],
              }}
              transition={{ 
                duration: 3 + i % 5, 
                repeat: Infinity, 
                delay: i * 0.4,
                ease: "linear"
              }}
              className="absolute h-[3px] w-16 bg-gradient-to-r from-transparent via-kobara-orange/60 to-transparent blur-[2px]"
              style={{ top: `${15 + i * 7}%` }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
