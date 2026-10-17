/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic media tray strip for editors (Image, Video, Audio).
 * Strictly follows THE AXON LOOK. Knows nothing about images.
 */

import React from 'react';
import { Check, Plus } from 'lucide-react';

export interface MediaStripItem {
  id: string;
  name: string;
  thumb?: string;
}

export interface MediaStripProps {
  items: MediaStripItem[];
  activeId: string | null;
  removeMode: boolean;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAdd: () => void;
  canAdd: boolean;
}

export const MediaStrip: React.FC<MediaStripProps> = ({
  items,
  activeId,
  removeMode,
  selectedIds,
  onSelect,
  onToggleSelect,
  onAdd,
  canAdd,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto border-b border-white/5 bg-[#141517]">
      {items.map((item) => {
        const isActive = item.id === activeId;
        const isSelected = selectedIds.includes(item.id);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (removeMode) {
                onToggleSelect(item.id);
              } else {
                onSelect(item.id);
              }
            }}
            aria-label={item.name}
            title={item.name}
            className={`w-11 h-11 shrink-0 rounded-lg overflow-hidden relative flex items-center justify-center cursor-pointer transition-colors bg-[#1C1D21] ${
              isActive ? 'border border-white' : 'border border-white/10'
            }`}
          >
            {item.thumb ? (
              <img
                src={item.thumb}
                alt={item.name}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <span className="text-[10px] text-[#7A7C82] truncate px-1 select-none">
                {item.name}
              </span>
            )}

            {/* Remove mode tick */}
            {removeMode && (
              <div
                className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-white text-black'
                    : 'border border-white/30 bg-black/60'
                }`}
              >
                {isSelected && <Check size={10} strokeWidth={2.5} />}
              </div>
            )}
          </button>
        );
      })}

      {/* Add tile at the end */}
      {canAdd && !removeMode && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add item"
          title="Add"
          className="w-11 h-11 shrink-0 rounded-lg border border-white/10 flex items-center justify-center text-[#8E9094] hover:bg-white/5 cursor-pointer transition-colors"
        >
          <Plus size={20} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
};

export default MediaStrip;
