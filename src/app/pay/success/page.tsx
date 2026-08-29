"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Home, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import { processSuccessfulPayment } from "./actions";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");
  const amount = searchParams.get("amount");
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (reference && !processed) {
      processSuccessfulPayment(reference).then((res) => {
        setProcessed(true);
        if (res.success && res.redirectUrl) {
          window.location.href = res.redirectUrl;
        }
      }).catch(console.error);
    }
  }, [reference, processed]);
  
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full"
      >
        <Card className="border-none shadow-2xl overflow-hidden">
          <div className="h-2 bg-emerald-500 w-full" />
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="bg-emerald-100 p-3 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Paiement Réussi !</CardTitle>
            <CardDescription className="text-slate-500">
              Votre transaction a été traitée avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-slate-500">Montant</span>
                <span className="text-lg font-bold text-slate-900">{amount ? `${amount} HTG` : "---"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Référence</span>
                <span className="text-sm font-mono text-slate-700">{reference || "---"}</span>
              </div>
            </div>
            
            <p className="text-center text-sm text-slate-500">
              Un reçu a été envoyé au marchand. Merci d'avoir utilisé Kobara.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-8">
            <Link 
              href="/" 
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-200"
              )}
            >
              Retour à l'accueil
              <Home className="ml-2 w-4 h-4" />
            </Link>
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
              Sécurisé par Kobara
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
