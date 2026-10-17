/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScreenHeader: Shared header band and back navigation row for AXON screens.
 * Matches the reference header band in AxonToolsScreen with pixel accuracy.
 */

import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';

export interface ScreenHeaderProps {
  title: string;
  tagline: string;
  onLogoClick: () => void;
  onBack?: () => void;
  backLabel?: string;
  collapsible?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  tagline,
  onLogoClick,
  onBack,
  backLabel,
  collapsible = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="shrink-0 z-20 flex flex-col select-none">
      {/* 1. Header Band */}
      {isCollapsed ? (
        <header className="px-5 h-[44px] bg-[#141517] border-b border-white/5 flex items-center justify-between shrink-0 transition-opacity duration-150">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogoClick}
              aria-label="AXON Navigation"
              title="Toggle navigation menu"
              className="p-1 -ml-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-start cursor-pointer group shrink-0"
            >
              <AxonLogo className="w-[24px] h-[24px] shrink-0 group-hover:opacity-90 transition-opacity" />
            </button>
            <span className="font-serif text-[17px] font-normal tracking-wide text-white leading-tight">
              {title}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Unfold header"
            title="Unfold header"
            className="p-1.5 -mr-1 rounded-xl text-[#9A9B9F] hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <ChevronDown size={18} />
          </button>
        </header>
      ) : (
        <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 transition-opacity duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* AXON Tree Logo */}
              <button
                type="button"
                onClick={onLogoClick}
                aria-label="AXON Navigation"
                title="Toggle navigation menu"
                className="p-1 -ml-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer group shrink-0"
              >
                <AxonLogo className="w-[32px] h-[32px] shrink-0 group-hover:opacity-90 transition-opacity" />
              </button>

              <div className="flex items-center">
                <span className="font-serif text-[23px] sm:text-[25px] font-semibold tracking-wide text-white leading-tight">
                  AXON
                </span>
                <span className="font-serif text-[23px] sm:text-[25px] font-normal tracking-wide text-[#ECECEC] ml-2 leading-tight">
                  {title}
                </span>
              </div>
            </div>

            {collapsible && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                aria-label="Fold header"
                title="Fold header"
                className="p-1.5 -mr-1 rounded-xl text-[#9A9B9F] hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <ChevronUp size={18} />
              </button>
            )}
          </div>

          {/* Small-caps tagline below */}
          <div className="pt-1 pl-1">
            <span className="text-[10px] sm:text-[10.5px] text-[#9A9B9F] tracking-widest font-sans uppercase">
              INTELLIGENCE IN MOTION · {tagline}
            </span>
          </div>
        </header>
      )}

      {/* 2. Back Row */}
      {onBack && (
        <div className="px-5 py-1.5 border-b border-white/5 bg-[#121315] shrink-0">
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel ? `Back to ${backLabel}` : 'Back'}
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl text-[#9A9B9F] hover:text-white hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest">
              {backLabel ?? 'BACK'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ScreenHeader;
