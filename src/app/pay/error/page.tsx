"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import { processFailedPayment } from "./actions";

function ErrorContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const reason = searchParams.get("reason");
  const isExpired = reason === 'expired';
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (reference && !processed) {
      processFailedPayment(reference).then((res) => {
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
          <div className="h-2 bg-red-500 w-full" />
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {isExpired ? 'Paiement expiré' : 'Paiement échoué'}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {isExpired
                ? "Le paiement n'a pas été confirmé par le fournisseur dans le délai de 10 minutes."
                : "Votre transaction n'a pas pu être traitée."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Référence</span>
                <span className="text-sm font-mono text-slate-700">{reference || "---"}</span>
              </div>
            </div>
            
            <p className="text-center text-sm text-slate-500">
              Si vous pensez que c'est une erreur, veuillez contacter le marchand ou réessayer.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-8">
            <Link 
              href="/" 
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full rounded-xl h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              Retour à l'accueil
              <Home className="ml-2 w-4 h-4" />
            </Link>
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold mt-2">
              Sécurisé par Kobara
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function PaymentErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
