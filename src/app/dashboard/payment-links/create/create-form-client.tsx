'use client'

import { useState } from 'react';
import Link from 'next/link';
import { createPaymentLink } from '../actions';
import { toast } from 'sonner';

export function CreatePaymentLinkForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageType, setImageType] = useState<'url' | 'upload'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [collectAddress, setCollectAddress] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.url) {
        setImageUrl(data.url);
        toast.success('Image téléchargée avec succès');
      }
    } catch (err) {
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await createPaymentLink(formData);
      if (res && res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      
      toast.success("Lien de paiement créé !");
      window.location.href = '/payment-links';
    } catch (err: any) {
      if (err.message === 'NEXT_REDIRECT') {
        throw err; // Let Next.js handle it
      }
      setError(err.message || "Une erreur inattendue s'est produite.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-bold text-white">Nom du produit ou service *</label>
        <input 
          type="text" 
          id="title" 
          name="title" 
          required
          placeholder="ex: Consultation vidéo 1h"
          className="w-full px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-500"
        />
        <p className="text-slate-400 text-xs">Ce que vos clients verront lors du paiement.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="amount" className="block text-sm font-bold text-white">Montant (HTG) *</label>
        <input 
          type="number" 
          id="amount" 
          name="amount" 
          required
          step="0.01"
          min="10"
          placeholder="ex: 1500.00"
          className="w-full px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-500"
        />
        <p className="text-slate-400 text-xs">Le montant fixe à payer en Gourdes Haïtiennes.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-bold text-white">Description (Optionnel)</label>
        <textarea 
          id="description" 
          name="description" 
          rows={3}
          placeholder="Détails supplémentaires sur le paiement..."
          className="w-full px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-500"
        ></textarea>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white">Affichage Produit (Optionnel)</h3>
        <p className="text-xs text-slate-400">Personnalisez l'apparence du lien de paiement avec les détails du produit.</p>
        
        <div className="space-y-4 pt-2">

          
          <div className="space-y-3">
            <label className="block text-sm font-bold text-white">Image du produit</label>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setImageType('url')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${imageType === 'url' ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                Lien (URL)
              </button>
              <button 
                type="button"
                onClick={() => setImageType('upload')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${imageType === 'upload' ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                Importer
              </button>
            </div>

            {imageType === 'url' ? (
              <input 
                type="url" 
                id="product_image" 
                name="product_image" 
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Ex: https://mon-site.com/image.jpg"
                className="w-full px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-500"
              />
            ) : (
              <div className="space-y-2">
                <input type="hidden" name="product_image" value={imageUrl} />
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="w-full px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                />
                {uploadingImage && <p className="text-orange-400 text-xs">Upload en cours...</p>}
                {imageUrl && !uploadingImage && imageType === 'upload' && (
                  <p className="text-green-400 text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Image prête
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white">Options supplémentaires</h3>
        <p className="text-xs text-slate-400">Informations à collecter auprès du client lors du paiement.</p>
        
        <div className="space-y-4 pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="collect_phone" value="true" className="w-5 h-5 sm:w-4 sm:h-4 text-orange-500 bg-white/10 border-white/20 rounded focus:ring-orange-500 focus:ring-2" />
            <span className="text-base sm:text-sm font-bold text-white">Demander le numéro de téléphone</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              name="collect_address" 
              value="true" 
              checked={collectAddress}
              onChange={(e) => setCollectAddress(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-orange-500 bg-white/10 border-white/20 rounded focus:ring-orange-500 focus:ring-2" 
            />
            <span className="text-base sm:text-sm font-bold text-white">Demander l'adresse de livraison</span>
          </label>
          {collectAddress && (
            <div className="pl-8 pt-2">
              <label htmlFor="shipping_fee" className="block text-sm font-bold text-white mb-2">Frais de livraison (HTG)</label>
              <input 
                type="number" 
                id="shipping_fee" 
                name="shipping_fee" 
                step="0.01"
                min="0"
                placeholder="Ex: 250.00"
                className="w-full sm:w-1/2 px-4 py-3 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white">Frais de transaction</h3>
        <p className="text-xs text-slate-400">Choisissez qui prend en charge les frais de paiement.</p>
        
        <div className="space-y-4 pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="pass_fees_to_customer" value="true" className="w-5 h-5 sm:w-4 sm:h-4 mt-0.5 text-orange-500 bg-white/10 border-white/20 rounded focus:ring-orange-500 focus:ring-2" />
            <div>
              <span className="text-base sm:text-sm font-bold text-white">Faire payer les frais par le client</span>
              <p className="text-sm sm:text-xs text-slate-400 mt-1">Si activé, le client paiera le montant du lien + les frais Kobara. Vous recevrez le montant exact du lien.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 flex flex-col-reverse sm:flex-row justify-end gap-3">
        <Link 
          href="/payment-links"
          className="w-full sm:w-auto text-center px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          Annuler
        </Link>
        <button 
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-orange-500 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer le lien'}
        </button>
      </div>
    </form>
  );
}
