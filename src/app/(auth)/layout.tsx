import { AuthVisual } from "@/components/auth/AuthVisual";
import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex bg-[#020B14] overflow-hidden selection:bg-[#FF4A1C]/30 selection:text-white font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #020B14 !important;
        }
      `}} />
      
      {/* Left Panel - Auth Form */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-between px-6 sm:px-12 lg:px-16 py-10 relative z-10 overflow-y-auto">
        
        {/* Top Header - Logo */}
        <div className="flex items-center justify-between mb-12 lg:mb-20">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#07111F] border border-[#1E2A38] flex items-center justify-center p-2 shadow-[0_0_15px_rgba(255,74,28,0.1)] group-hover:shadow-[0_0_20px_rgba(255,74,28,0.3)] transition-all">
              <Image src="/Icone.png" alt="Kobara Logo" width={24} height={24} className="object-contain" />
            </div>
            <span className="text-white font-black text-xl tracking-tight">Kobara</span>
          </Link>
        </div>

        {/* Main Content (Login/Register Form) */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[420px] mx-auto">
            {children}
          </div>
        </div>
        
        {/* Footer links */}
        <div className="flex justify-between items-center mt-12 pt-8 border-t border-[#1E2A38] text-xs font-medium text-[#AAB3C2]">
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
          <div>© {new Date().getFullYear()} Kobara</div>
        </div>
      </div>
      
      {/* Right Panel - Immersive Visual */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-[#07111F] border-l border-[#1E2A38]">
        <AuthVisual />
      </div>
      
    </div>
  );
}
