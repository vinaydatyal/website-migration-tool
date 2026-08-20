import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UrlMapping } from '../types/migration';

interface MappingStatusChartProps {
  mappings: UrlMapping[];
}

export const MappingStatusChart: React.FC<MappingStatusChartProps> = ({ mappings }) => {
  const statusCounts = mappings.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: 'Approved', value: statusCounts['APPROVED'] || 0, color: '#10b981' }, // emerald-500
    { name: 'Manual Override', value: statusCounts['MANUAL'] || 0, color: '#3b82f6' }, // blue-500
    { name: 'Needs Review', value: statusCounts['NEEDS_REVIEW'] || 0, color: '#f59e0b' }, // amber-500
    { name: 'Rejected', value: statusCounts['REJECTED'] || 0, color: '#ef4444' }, // red-500
    { name: 'Hidden (410)', value: statusCounts['GONE_410'] || 0, color: '#64748b' }, // slate-500
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">No mappings available</div>;
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
