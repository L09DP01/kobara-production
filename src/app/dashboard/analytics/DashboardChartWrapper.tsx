"use client";

import { useState } from "react";
import RevenueChart from "./RevenueChart";

interface DashboardChartPayment {
  amount: number | string;
  net_amount?: number | string | null;
  created_at?: string | null;
}

export default function DashboardChartWrapper({ payments }: { payments: DashboardChartPayment[] }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  // Group by date based on period
  const chartDataMap = new Map();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  for (let i = 0; i <= period; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (period - i));
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    chartDataMap.set(dateStr, 0);
  }

  if (payments) {
    payments.forEach(p => {
      if (!p.created_at) return;
      const d = new Date(p.created_at);
      if (d >= startDate) {
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (chartDataMap.has(dateStr)) {
          chartDataMap.set(dateStr, chartDataMap.get(dateStr) + Number(p.net_amount || p.amount));
        }
      }
    });
  }

  const chartData = Array.from(chartDataMap.entries()).map(([date, revenue]) => ({ date, revenue }));

  return (
    <div className="h-full rounded-lg border border-[#27364B] bg-[#111C2C] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Flux financier</h2>
          <p className="mt-1 text-xs text-slate-500">Revenus nets encaissés</p>
        </div>
        <div className="flex w-fit items-center rounded-lg border border-[#2B3A51] bg-[#0D1828] p-1">
          <button onClick={() => setPeriod(7)} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors duration-150 ${period === 7 ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>7j</button>
          <button onClick={() => setPeriod(30)} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors duration-150 ${period === 30 ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>30j</button>
          <button onClick={() => setPeriod(90)} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors duration-150 ${period === 90 ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>90j</button>
        </div>
      </div>
      <div className="h-60 w-full sm:h-72 lg:h-[340px]">
        <RevenueChart data={chartData} />
      </div>
    </div>
  );
}
