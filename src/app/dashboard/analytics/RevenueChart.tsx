"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-60 flex-1 flex-col items-center justify-center rounded-lg border border-[#27364B] bg-[#0D1828]">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-slate-400 text-3xl">bar_chart</span>
        </div>
        <p className="text-white font-bold">Aucune donnée disponible</p>
        <p className="text-slate-400 text-sm mt-1">Les données de cette période n'ont pas encore été générées.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 8,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            minTickGap={28}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            width={48}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value) => `${value.toLocaleString()}`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #34465F', background: '#091321', color: '#fff', boxShadow: '0 12px 30px rgb(0 0 0 / 0.25)' }}
            formatter={(value: any) => [`${value.toLocaleString()} HTG`, 'Revenus']}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#F97316" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
