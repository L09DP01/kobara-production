"use client";

import { motion } from "framer-motion";

export function FloatingBackground() {
  return (
    <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none bg-landing-bg">
      {/* Primary blobs */}
      <motion.div 
        animate={{ 
          x: [0, 50, 0],
          y: [0, -30, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-radial from-rose-200/40 to-transparent blur-[120px] rounded-full" 
      />
      
      <motion.div 
        animate={{ 
          x: [0, -40, 0],
          y: [0, 40, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] left-[-5%] w-[700px] h-[700px] bg-gradient-radial from-blue-200/40 to-transparent blur-[120px] rounded-full" 
      />

      <motion.div 
        animate={{ 
          x: [0, 30, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-gradient-radial from-orange-100/30 to-transparent blur-[100px] rounded-full" 
      />

      {/* Grid Pattern Subtile */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
    </div>
  );
}
