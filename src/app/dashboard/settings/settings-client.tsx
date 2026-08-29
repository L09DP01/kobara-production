'use client'

import { useState } from 'react';
import { ProfileSettings } from './components/ProfileSettings';
import { SecuritySettings } from './components/SecuritySettings';
import { NotificationSettings } from './components/NotificationSettings';
import { TeamSettings } from './components/TeamSettings';
import { PayoutSettings } from './components/PayoutSettings';
import { Store, CreditCard, Shield, Bell, Users, Settings as SettingsIcon } from 'lucide-react';

type Tab = 'profile' | 'payouts' | 'security' | 'notifications' | 'team';

export function SettingsClient({ user, merchant, settings, members, userRole = 'owner' }: { user: any, merchant: any, settings: any, members: any[], userRole?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: { id: Tab, label: string, icon: any, desc: string, ownerOnly?: boolean }[] = [
    { id: 'profile', label: 'Profil Entreprise', icon: Store, desc: 'Logo, nom, adresse' },
    { id: 'payouts', label: 'Comptes de Retrait', icon: CreditCard, desc: 'MonCash, banques', ownerOnly: true },
    { id: 'security', label: 'Sécurité & Sessions', icon: Shield, desc: 'Passkey, 2FA, Appareils', ownerOnly: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Email, push, alertes' },
    { id: 'team', label: "Membres d'équipe", icon: Users, desc: 'Rôles et accès' },
  ];

  const visibleTabs = tabs.filter(t => !t.ownerOnly || userRole === 'owner');

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-16 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E2A38]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 flex items-center justify-center text-[#FF4A1C] shadow-[0_0_20px_rgba(255,74,28,0.15)]">
            <SettingsIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Paramètres</h1>
            <p className="text-slate-400 text-sm mt-1">
              Gérez le profil de votre entreprise, la sécurité de vos accès et vos appareils connectés.
            </p>
          </div>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#07111F] border border-[#1E2A38] rounded-full text-xs font-semibold text-slate-300 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-[#27C93F] animate-pulse" />
          <span>{merchant?.business_name || 'Marchand Kobara'}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Navigation Sidebar (Desktop + Horizontal Scroll Mobile) */}
        <div className="lg:col-span-4 xl:col-span-3">
          
          {/* Mobile Horizontal Tabs */}
          <div className="flex lg:hidden overflow-x-auto gap-2 pb-2 scrollbar-none">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl font-bold text-xs whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-[#FF4A1C] text-white border-[#FF4A1C] shadow-[0_0_15px_rgba(255,74,28,0.3)]'
                      : 'bg-[#07111F] text-slate-400 border-[#1E2A38] hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Vertical Sidebar Tabs */}
          <nav className="hidden lg:flex flex-col gap-2 bg-[#07111F] border border-[#1E2A38] rounded-3xl p-3 shadow-xl">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all duration-200 group relative border ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#FF4A1C]/15 to-[#FF4A1C]/5 border-[#FF4A1C]/40 text-white shadow-[0_0_20px_rgba(255,74,28,0.1)]' 
                      : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${
                    isActive ? 'bg-[#FF4A1C] text-white shadow-[0_0_10px_rgba(255,74,28,0.4)]' : 'bg-[#0F1626] text-slate-400 group-hover:text-white'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold block truncate">{tab.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium block truncate">{tab.desc}</span>
                  </div>

                  {isActive && (
                    <div className="w-1.5 h-6 bg-[#FF4A1C] rounded-full shadow-[0_0_8px_#FF4A1C]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Component Area */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {activeTab === 'profile' && <ProfileSettings user={user} merchant={merchant} />}
          {activeTab === 'payouts' && <PayoutSettings settings={settings} />}
          {activeTab === 'security' && <SecuritySettings user={user} settings={settings} />}
          {activeTab === 'notifications' && <NotificationSettings settings={settings} />}
          {activeTab === 'team' && <TeamSettings members={members} userRole={userRole} />}
        </div>
      </div>
    </div>
  );
}
