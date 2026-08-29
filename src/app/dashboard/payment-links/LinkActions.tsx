'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function LinkActions({ linkId, linkUrl }: { linkId: string, linkUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setShowQR(true)}
          className="p-1.5 text-text-secondary hover:text-primary rounded hover:bg-surface-container-high transition-colors inline-flex" 
          title="Afficher le QR Code"
        >
          <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
        </button>
        <button 
          onClick={handleCopy}
          className={`p-1.5 rounded transition-colors ${copied ? 'text-status-success bg-status-success/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-high'}`}
          title={copied ? "Copié !" : "Copier le lien"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
        <Link 
          href={`/payment-links/edit/${linkId}`}
          className="p-1.5 text-text-secondary hover:text-text-primary rounded hover:bg-surface-container-high transition-colors inline-flex" 
          title="Modifier"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </Link>
      </div>

      {showQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-2xl p-6 w-full max-w-xs shadow-2xl flex flex-col items-center">
            <h3 className="text-lg font-bold text-text-primary mb-4 text-center">QR Code de paiement</h3>
            
            <div className="bg-white p-4 rounded-xl mb-6 shadow-sm border border-gray-100">
              <QRCodeSVG 
                value={linkUrl} 
                size={200}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            <p className="text-xs text-text-secondary text-center mb-6">Vos clients peuvent scanner ce code avec leur téléphone pour payer via MonCash.</p>
            
            <button 
              onClick={() => setShowQR(false)}
              className="w-full px-4 py-2.5 bg-surface-container-high text-text-primary rounded-xl text-sm font-semibold hover:bg-surface-container-highest transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
