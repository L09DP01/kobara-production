'use client';

import { useState } from 'react';

export default function ExportCsvButton({ payments }: { payments: any[] }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    try {
      // Define CSV headers
      const headers = [
        'ID Transaction',
        'Reference Kobara',
        'Nom Client',
        'Email Client',
        'Montant Brut (HTG)',
        'Frais (HTG)',
        'Montant Net (HTG)',
        'Statut',
        'Methode',
        'Date de creation'
      ];

      // Convert payments to CSV rows
      const csvRows = payments.map(p => {
        return [
          p.id,
          p.kobara_reference || '',
          p.customers?.name || 'Inconnu',
          p.customers?.email || '',
          p.amount,
          p.fee_amount || 0,
          p.net_amount || p.amount,
          p.status,
          p.provider || p.payment_method || 'moncash',
          new Date(p.created_at).toISOString()
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
      });

      // Combine headers and rows
      const csvContent = [headers.join(','), ...csvRows].join('\n');

      // Create blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `kobara_export_paiements_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erreur lors de l'export CSV", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExport}
      disabled={exporting || payments.length === 0}
      className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-border-subtle rounded-lg text-sm font-medium text-text-primary hover:bg-surface-container hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      title="Exporter en CSV"
    >
      <span className="material-symbols-outlined text-[18px]">download</span>
      <span className="hidden sm:inline">{exporting ? 'Export en cours...' : 'Exporter CSV'}</span>
    </button>
  );
}
