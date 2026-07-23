import React from 'react';
import { ToolType } from '../../types';
import { 
  MousePointer2, 
  Type, 
  StickyNote, 
  PenTool, 
  Highlighter, 
  Eraser, 
  Lasso,
  Undo2,
  Redo2,
  Hand,
  ImagePlay,
  FileText
} from 'lucide-react';

interface ToolsDockProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const ToolsDock: React.FC<ToolsDockProps> = ({ 
  activeTool, 
  onToolChange, 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo 
}) => {
  
  const tools: { id: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'SELECT', icon: <MousePointer2 size={18} />, label: 'Select (V)', shortcut: 'V' },
    { id: 'PAN', icon: <Hand size={18} />, label: 'Pan (H)', shortcut: 'H' },
    { id: 'TEXT', icon: <Type size={18} />, label: 'Text (T)', shortcut: 'T' },
    { id: 'STICKY', icon: <StickyNote size={18} />, label: 'Note (N)', shortcut: 'N' },
    { id: 'DOC', icon: <FileText size={18} />, label: 'Doc', shortcut: 'D' },
    { id: 'PEN', icon: <PenTool size={18} />, label: 'Pen (P)', shortcut: 'P' },
    { id: 'HIGHLIGHTER', icon: <Highlighter size={18} />, label: 'Highlighter', shortcut: 'M' },
    { id: 'ERASER', icon: <Eraser size={18} />, label: 'Eraser (E)', shortcut: 'E' },
    { id: 'LASSO', icon: <Lasso size={18} />, label: 'Lasso', shortcut: 'L' },
    { id: 'REFERENCE', icon: <ImagePlay size={18} />, label: 'Reference', shortcut: 'R' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3">
      
      {/* Tool Group */}
      <div className="flex items-center p-1.5 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`
                relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group
                ${isActive 
                  ? 'bg-[#3A5C34]/10 text-[#3A5C34] shadow-sm ring-1 ring-[#3A5C34]/20' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
              title={tool.label}
            >
              {tool.icon}
              {isActive && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#3A5C34]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* History Group */}
      <div className="flex items-center p-1.5 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
         <button 
           onClick={onUndo} 
           disabled={!canUndo}
           className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
         >
           <Undo2 size={18} />
         </button>
         <button 
           onClick={onRedo} 
           disabled={!canRedo}
           className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
         >
           <Redo2 size={18} />
         </button>
      </div>
    </div>
  );
};
