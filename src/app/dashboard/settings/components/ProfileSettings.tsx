'use client'

import { useState } from 'react';
import { updateMerchantProfile } from '../actions';
import { toast } from "sonner";

export function ProfileSettings({ user, merchant }: { user: any, merchant: any }) {
  console.log("ProfileSettings client component received user:", user);
  let parsedAddress = { address: '', city: '', state: '', country: '', zipcode: '' };
  try {
    if (merchant?.address && merchant.address.startsWith('{')) {
      parsedAddress = { ...parsedAddress, ...JSON.parse(merchant.address) };
    } else if (merchant?.address) {
      parsedAddress.address = merchant.address;
    }
  } catch(e) {}

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    business_name: string;
    category: string;
    email: string;
    phone: string;
    first_name: string;
    last_name: string;
    logo_preview: string;
    logo_url?: string;
    address: string;
    city: string;
    state: string;
    country: string;
    zipcode: string;
  }>({
    business_name: merchant.business_name || '',
    category: merchant.category || '',
    email: merchant.email || '',
    phone: merchant.phone || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    logo_preview: merchant?.logo_url || '',
    logo_url: merchant?.logo_url || undefined,
    address: parsedAddress.address,
    city: parsedAddress.city,
    state: parsedAddress.state,
    country: parsedAddress.country,
    zipcode: parsedAddress.zipcode
  });

  const autoDetectLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data && data.country_name) {
        setFormData(prev => ({
          ...prev,
          city: data.city || prev.city,
          state: data.region || prev.state,
          country: data.country_name || prev.country,
          zipcode: data.postal || prev.zipcode
        }));
      }
    } catch (e) {
      console.error("Failed to auto-detect location", e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateMerchantProfile(formData);
      toast.success("Paramètres du profil sauvegardés avec succès !");
    } catch (err: any) {
      toast.error(err.message || "Erreur de sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Personal Info Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-white mb-6">Informations Personnelles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white">Prénom</label>
            <input 
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              type="text" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white">Nom</label>
            <input 
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              type="text" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-bold text-white">Email du compte</label>
            <input 
              disabled
              value={user?.email || ''}
              type="email" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-500 cursor-not-allowed shadow-sm" 
            />
          </div>
        </div>
      </div>

      {/* Business Info Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Informations de l'entreprise</h2>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
        
        <div className="space-y-5">
          <div className="flex items-center gap-6 mb-6">
            <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group">
              {formData.logo_preview ? (
                <img src={formData.logo_preview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-slate-500">{formData.business_name.charAt(0) || 'K'}</span>
              )}
            </div>
            <div>
              <input 
                type="file" 
                id="logo_upload" 
                className="hidden" 
                accept="image/jpeg, image/png, image/gif"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1024 * 1024) {
                      toast.error("Le fichier est trop volumineux (max 1MB).");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64Img = reader.result as string;
                      setFormData(prev => ({ ...prev, logo_preview: base64Img, logo_url: base64Img }));
                      try {
                        setLoading(true);
                        await updateMerchantProfile({ ...formData, logo_url: base64Img });
                        toast.success("Logo mis à jour avec succès !");
                      } catch (err: any) {
                        toast.error(err.message || "Erreur lors de la sauvegarde du logo");
                      } finally {
                        setLoading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label 
                htmlFor="logo_upload"
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/10 transition-colors mb-2 cursor-pointer inline-block shadow-sm"
              >
                Changer le logo
              </label>
              <p className="text-xs text-slate-400 font-medium">JPG, GIF ou PNG. Max 1MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-white">Nom de l'entreprise</label>
              <input 
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                type="text" 
                required
                maxLength={255}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white">Secteur d'activité</label>
            <select 
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all appearance-none [&>option]:bg-[#131B2C]"
            >
              <option value="">Sélectionner</option>
              <option value="Logiciels / SaaS">Logiciels / SaaS</option>
              <option value="E-commerce">E-commerce</option>
              <option value="Services professionnels">Services professionnels</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <label className="text-sm font-bold text-white">Email de contact</label>
          <input 
            name="email"
            value={formData.email}
            onChange={handleChange}
            type="email" 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
          />
        </div>
        
        <div className="space-y-1.5 mt-4">
          <label className="text-sm font-bold text-white">Téléphone</label>
          <input 
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            type="tel" 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
          />
        </div>
        
        <div className="pt-6 mt-6 border-t border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Adresse complète</h3>
            <button
              type="button"
              onClick={autoDetectLocation}
              className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">my_location</span>
              Autodétecter ma position
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-bold text-white">Adresse / Rue</label>
              <input 
                name="address"
                value={formData.address}
                onChange={handleChange}
                type="text" 
                placeholder="Ex: 123 Rue Principale"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-white">Ville</label>
              <input 
                name="city"
                value={formData.city}
                onChange={handleChange}
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-white">Département / Région</label>
              <input 
                name="state"
                value={formData.state}
                onChange={handleChange}
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-white">Code Postal</label>
              <input 
                name="zipcode"
                value={formData.zipcode}
                onChange={handleChange}
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-white">Pays</label>
              <input 
                name="country"
                value={formData.country}
                onChange={handleChange}
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-white shadow-sm transition-all" 
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
