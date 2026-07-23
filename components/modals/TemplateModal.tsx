import React, { useState } from 'react';
import { X, LayoutTemplate, Plus, Image as ImageIcon, FileText } from 'lucide-react';

export interface TemplateModalProps {
  onClose: () => void;
  onSelectTemplate: (templateId: string | null) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ onClose, onSelectTemplate }) => {
  const [view, setView] = useState<'initial' | 'gallery'>('initial');

  if (view === 'initial') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Create New Whiteboard</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 flex flex-col gap-4">
            <button 
              onClick={() => onSelectTemplate(null)}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#3A5C34] hover:bg-[#3A5C34]/5 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center flex-shrink-0">
                <Plus size={24} className="text-gray-500 group-hover:text-[#3A5C34]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-[#3A5C34]">Start from scratch</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">Open a blank canvas and build your own workflow.</p>
              </div>
            </button>
            
            <button 
              onClick={() => setView('gallery')}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#FFD753] hover:bg-[#FFD753]/10 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center flex-shrink-0">
                <LayoutTemplate size={24} className="text-gray-500 group-hover:text-[#854D0E]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-[#854D0E]">Choose a template</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">Start with a pre-built layout by SOSA.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const templates = [
    {
      id: 'monthly-plan',
      name: 'Monthly Content Plan',
      description: 'Feed Planner with 12 slots and 3 example posts.',
      color: '#3A5C34',
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
      icon: <LayoutTemplate size={24} />
    },
    {
      id: 'product-launch',
      name: 'Product Launch Campaign',
      description: '5-stage narrative: Teaser to CTA.',
      color: '#FFD753',
      thumbnail: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80',
      icon: <FileText size={24} />
    },
    {
      id: 'weekly-routine',
      name: 'Weekly Content Routine',
      description: '4 posts mapped to days of the week.',
      color: '#FCCAE2',
      thumbnail: 'https://images.unsplash.com/photo-1506784951209-6854d59ca41e?w=800&q=80',
      icon: <LayoutTemplate size={24} />
    },
    {
      id: 'brand-moodboard',
      name: 'Brand Aesthetic Moodboard',
      description: '6 empty posts and sticky notes for visual direction.',
      color: '#5F2427',
      thumbnail: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
      icon: <ImageIcon size={24} />
    },
    {
      id: 'shooting-prep',
      name: 'Shooting Day Prep',
      description: '4 posts with pre-filled production lists.',
      color: '#FF9500',
      thumbnail: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
      icon: <FileText size={24} />
    }
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[#F9F8F6] rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 bg-white border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Template Gallery</h2>
            <p className="text-[14px] text-gray-500 mt-1">Pre-built layouts by SOSA to jumpstart your workflow.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(t => (
              <div 
                key={t.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden flex flex-col group"
              >
                <div className="h-2 w-full" style={{ backgroundColor: t.color }}></div>
                <div className="h-32 w-full bg-gray-100 relative overflow-hidden">
                    <img src={t.thumbnail} alt={t.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity mix-blend-multiply" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t.name}</h3>
                  <p className="text-[13px] text-gray-500 flex-1">{t.description}</p>
                  
                  <button 
                    onClick={() => onSelectTemplate(t.id)}
                    className="mt-6 w-full py-2.5 rounded-lg font-bold text-[13px] border-2 transition-colors"
                    style={{ borderColor: t.color, color: t.color }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = t.color;
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = t.color;
                    }}
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
