import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProgressChartProps {
  snapshots: any[]; // MigrationSnapshot isn't fully exported in some cases, so we'll pass the array
  currentScore: number;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ snapshots, currentScore }) => {
  const data = snapshots.map((s, index) => ({
    name: `v${index + 1}`,
    score: s.stats.readinessScore,
    date: new Date(s.timestamp).toLocaleDateString(),
  }));

  // Add the current state
  data.push({
    name: 'Current',
    score: currentScore,
    date: new Date().toLocaleDateString(),
  });

  if (data.length <= 1) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Not enough data to show progress. Save a snapshot first!</div>;
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
          />
          <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
