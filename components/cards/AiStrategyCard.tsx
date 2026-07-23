import React, { useState } from 'react';
import { BaseCard } from './BaseCard';
import { CardData } from '../../types';
import { Sparkles, Bot, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateMarketingStrategy } from '../../services/geminiService';

interface AiStrategyCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

const ALLOWED_TAGS = new Set(['ul', 'ol', 'li', 'p', 'strong', 'em', 'br', 'b', 'i']);

function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const lower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(lower)) {
      return match.startsWith('</') ? `</${lower}>` : `<${lower}>`;
    }
    return '';
  }).replace(/on\w+\s*=/gi, '');
}

export const AiStrategyCard: React.FC<AiStrategyCardProps> = (props) => {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    const strategy = await generateMarketingStrategy(topic, audience, "Professional yet punchy");
    setResult(strategy);
    setLoading(false);
  };

  return (
    <BaseCard 
      {...props} 
      title="Oracle AI" 
      // Using Deep Burgundy for the "Oracle" / Intelligence vibe
      icon={<Sparkles size={16} className="text-[#5F2427]"/>}
    >
      <div className="space-y-6">
        <div className="bg-[#F2F2F7] p-4 rounded-2xl">
          <p className="text-[13px] font-semibold text-[#5F2427] mb-3">Input Parameters</p>
          <div className="space-y-3">
            <input 
              className="w-full text-[15px] bg-white px-3 py-2.5 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-[#3A5C34]/20 transition-shadow placeholder-gray-400" 
              placeholder="What are we promoting?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <input 
              className="w-full text-[15px] bg-white px-3 py-2.5 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-[#3A5C34]/20 transition-shadow placeholder-gray-400" 
              placeholder="Target Audience?"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
            <button 
              className="w-full bg-[#3A5C34] hover:bg-[#2d4a29] text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
              onClick={handleGenerate}
              disabled={loading || !topic}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} className="text-[#FFD753]" />}
              <span>Generate Ideas</span>
            </button>
          </div>
        </div>

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="text-[13px] font-semibold text-gray-400 mb-3">Results</div>
             <div 
               className="text-[15px] leading-relaxed text-gray-800 space-y-2 prose prose-p:my-1 prose-ul:my-2 prose-li:my-0.5 marker:text-[#3A5C34]"
               dangerouslySetInnerHTML={{ __html: sanitizeHtml(result) }}
             />
             <Button variant="ghost" size="sm" className="w-full mt-4 text-[#5F2427] hover:bg-[#FCCAE2]/30" onClick={() => setResult(null)}>
               Clear Results
             </Button>
          </div>
        )}
      </div>
    </BaseCard>
  );
};