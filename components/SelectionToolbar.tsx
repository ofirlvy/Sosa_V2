import React, { useState } from 'react';
import { Group, Ungroup, AlignLeft, AlignCenter, AlignRight, AlignJustify, Copy, Lock, Unlock, Trash2 } from 'lucide-react';
import { CardData, CardType } from '../types';

interface SelectionToolbarProps {
    selectedCards: CardData[];
    groupBounds: { x: number, y: number, width: number, height: number } | null;
    onGroup: (color: string) => void;
    onUngroup: (zoneId: string) => void;
    onAlign: (alignment: string) => void;
    onDuplicate: () => void;
    onLockToggle: () => void;
    onDelete: () => void;
}

// App brand palette (pink, yellow, green, burgundy, peach) + neutral blue/gray.
const COLORS = ['#FCCAE2', '#FFD753', '#3A5C34', '#5F2427', '#F9E6D1', '#007AFF', '#8E8E93'];

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    selectedCards,
    groupBounds,
    onGroup,
    onUngroup,
    onAlign,
    onDuplicate,
    onLockToggle,
    onDelete
}) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showAlignMenu, setShowAlignMenu] = useState(false);

    if (!groupBounds || selectedCards.length < 2) return null;

    const allLocked = selectedCards.every(c => c.isLocked);
    
    const selectedZones = selectedCards.filter(c => c.type === CardType.ZONE);
    const canUngroup = selectedZones.length > 0;

    return (
        <div 
            className="absolute z-[100] flex flex-col items-center gap-2"
            style={{
                left: groupBounds.x + groupBounds.width / 2,
                top: groupBounds.y - 16,
                transform: 'translate(-50%, -100%)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1 p-1.5 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 whitespace-nowrap">
                
                {canUngroup ? (
                    <button 
                        onClick={() => onUngroup(selectedZones[0].id)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ungroup"
                    >
                        <Ungroup size={16} />
                    </button>
                ) : (
                    <div className="relative flex items-center">
                        <button 
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Group"
                        >
                            <Group size={16} />
                        </button>
                        {showColorPicker && (
                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-200">
                                {COLORS.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => {
                                            onGroup(color);
                                            setShowColorPicker(false);
                                        }}
                                        className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="w-px h-5 bg-gray-200 mx-1"></div>

                <div className="relative">
                    <button 
                        onClick={() => setShowAlignMenu(!showAlignMenu)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Align"
                    >
                        <AlignCenter size={16} />
                    </button>
                    {showAlignMenu && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-1.5 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <button onClick={() => onAlign('left')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignLeft size={14} /></button>
                                <button onClick={() => onAlign('center')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignCenter size={14} /></button>
                                <button onClick={() => onAlign('right')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignRight size={14} /></button>
                                <button onClick={() => onAlign('top')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignLeft size={14} className="rotate-90" /></button>
                                <button onClick={() => onAlign('middle')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignCenter size={14} className="rotate-90" /></button>
                                <button onClick={() => onAlign('bottom')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignRight size={14} className="rotate-90" /></button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => onAlign('distribute-h')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignJustify size={14} /></button>
                                <button onClick={() => onAlign('distribute-v')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><AlignJustify size={14} className="rotate-90" /></button>
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={onDuplicate}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Duplicate"
                >
                    <Copy size={16} />
                </button>

                <button 
                    onClick={onLockToggle}
                    className={`p-2 rounded-lg transition-colors ${allLocked ? 'text-blue-500 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'}`}
                    title={allLocked ? "Unlock" : "Lock"}
                >
                    {allLocked ? <Unlock size={16} /> : <Lock size={16} />}
                </button>

                <div className="w-px h-5 bg-gray-200 mx-1"></div>

                <button 
                    onClick={onDelete}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button>

            </div>
        </div>
    );
};
