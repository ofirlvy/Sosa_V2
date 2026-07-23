import React, { useEffect } from 'react';
import { BaseCard } from '../BaseCard';
import { CardData, PropTableContent } from '../../../types';
import { Package, CheckSquare, Square, Plus, Camera } from 'lucide-react';

interface PropTableCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const PropTableCard: React.FC<PropTableCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as PropTableContent;

  useEffect(() => {
    if (!content.items) {
      onUpdateContent(card.id, {
        title: 'Prop List',
        items: []
      });
    }
  }, []);

  const toggleStatus = (id: string) => {
      const next: Record<string, string> = { 'need': 'have', 'have': 'packed', 'packed': 'need' };
      const newItems = content.items.map(i => i.id === id ? { ...i, status: next[i.status] as any } : i);
      onUpdateContent(card.id, { ...content, items: newItems });
  };

  const addItem = () => {
      const newItem = { id: `prop-${Date.now()}`, name: 'New Item', status: 'need' as const };
      onUpdateContent(card.id, { ...content, items: [...content.items, newItem] });
  };

  const updateName = (id: string, name: string) => {
      const newItems = content.items.map(i => i.id === id ? { ...i, name } : i);
      onUpdateContent(card.id, { ...content, items: newItems });
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'need': return 'bg-red-50 text-red-500 border-red-100';
          case 'have': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
          case 'packed': return 'bg-green-50 text-green-600 border-green-100';
          default: return 'bg-gray-50';
      }
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Props"} 
      icon={<Package size={16} className="text-[#8B5CF6]" />} // Violet
    >
      <div className="flex flex-col h-full bg-white">
        {/* Table Header */}
        <div className="flex px-4 py-2 border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <div className="w-10">Image</div>
            <div className="flex-1">Item Name</div>
            <div className="w-16 text-center">Status</div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
            {content.items?.map(item => (
                <div key={item.id} className="flex items-center px-4 py-3 border-b border-gray-50 group hover:bg-gray-50 transition-colors">
                    {/* Image Slot */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 mr-3 shrink-0 cursor-pointer hover:border-[#8B5CF6]">
                        {item.imageUrl ? (
                            <img src={item.imageUrl} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                            <Camera size={14} />
                        )}
                    </div>

                    {/* Name Input */}
                    <input 
                        className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] font-medium text-gray-900 p-0 placeholder-gray-400"
                        value={item.name}
                        onChange={(e) => updateName(item.id, e.target.value)}
                        placeholder="Item name..."
                    />

                    {/* Status Pill */}
                    <button 
                        onClick={() => toggleStatus(item.id)}
                        className={`w-16 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${getStatusColor(item.status)}`}
                    >
                        {item.status}
                    </button>
                </div>
            ))}
            
            <button 
                onClick={addItem}
                className="w-full py-3 flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-colors"
            >
                <Plus size={14} /> Add Prop
            </button>
        </div>
      </div>
    </BaseCard>
  );
};