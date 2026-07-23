import React from 'react';
import { BaseCard } from './BaseCard';
import { CardData } from '../../types';
import { BarChart2, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, YAxis } from 'recharts';

interface AnalyticsCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

interface AnalyticsData {
  ctr?: string;
  change?: string;
  impressions?: string;
  spend?: string;
  dataPoints?: { name: string; value: number }[];
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = (card.content || {}) as AnalyticsData;
  const hasData = content.dataPoints && content.dataPoints.length > 0;

  const updateField = (field: string, value: string) => {
    onUpdateContent(card.id, { ...content, [field]: value });
  };

  return (
    <BaseCard {...props} title="Performance" icon={<TrendingUp size={16} className="text-[#3A5C34]"/>}>
      <div className="flex flex-col h-full">
        <div className="flex items-baseline gap-2 mb-6">
           <input
             className="text-[34px] font-bold text-gray-900 tracking-tight bg-transparent border-none p-0 focus:ring-0 w-28 placeholder-gray-300"
             placeholder="0.00%"
             value={content.ctr || ''}
             onChange={(e) => updateField('ctr', e.target.value)}
           />
           <input
             className="text-[15px] font-medium text-[#3A5C34] bg-transparent border-none p-0 focus:ring-0 w-16 placeholder-gray-300"
             placeholder="+0.0%"
             value={content.change || ''}
             onChange={(e) => updateField('change', e.target.value)}
           />
           <span className="text-[15px] text-gray-400 ml-auto">CTR</span>
        </div>

        {hasData ? (
          <div className="flex-1 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={content.dataPoints}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3A5C34" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#3A5C34" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  labelStyle={{display: 'none'}}
                  itemStyle={{color: '#1C1C1E', fontWeight: 600, fontSize: '13px'}}
                  cursor={{stroke: '#E5E5EA', strokeWidth: 1}}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3A5C34"
                  strokeWidth={2.5}
                  fill="url(#chartGradient)"
                  animationDuration={1000}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#8E8E93', fontSize: 11}}
                  dy={10}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">Enter your metrics above</p>
              <p className="text-[11px] mt-1">Analytics data will appear here</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
           <div>
             <div className="text-[13px] font-medium text-gray-400 mb-1">Impressions</div>
             <input
               className="text-[17px] font-semibold text-gray-900 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300"
               placeholder="—"
               value={content.impressions || ''}
               onChange={(e) => updateField('impressions', e.target.value)}
             />
           </div>
           <div>
             <div className="text-[13px] font-medium text-gray-400 mb-1">Spend</div>
             <input
               className="text-[17px] font-semibold text-gray-900 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300"
               placeholder="—"
               value={content.spend || ''}
               onChange={(e) => updateField('spend', e.target.value)}
             />
           </div>
        </div>
      </div>
    </BaseCard>
  );
};