import React from 'react';
import { ToolType } from '../../types';
import { 
  PenTool, 
  Highlighter, 
  Eraser, 
  Lasso,
  X,
  MousePointer2
} from 'lucide-react';

interface DrawingToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onClose: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({ 
  activeTool, 
  onToolChange, 
  onClose 
}) => {
  
  const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
    { id: 'PEN', icon: <PenTool size={18} />, label: 'Pen' },
    { id: 'HIGHLIGHTER', icon: <Highlighter size={18} />, label: 'Marker' },
    { id: 'ERASER', icon: <Eraser size={18} />, label: 'Eraser' },
    { id: 'LASSO', icon: <Lasso size={18} />, label: 'Lasso' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Label */}
      <div className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-md mb-1">
        Drawing Mode
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
        
        {/* Tools */}
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`
                relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                ${isActive 
                  ? 'bg-[#3A5C34]/10 text-[#3A5C34] shadow-sm ring-1 ring-[#3A5C34]/20' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
              title={tool.label}
            >
              {tool.icon}
            </button>
          );
        })}

        <div className="w-px h-6 bg-gray-200 mx-1"></div>

        {/* Close / Done */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Done (V)"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
