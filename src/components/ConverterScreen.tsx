/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit & Base Converter: AXON look and feel.
 * Converts units (Length, Weight, Temperature, etc.) and number bases live and offline.
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Binary,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FlaskConical,
  Gauge,
  HardDrive,
  Ruler,
  Scale,
  Search,
  Square,
  Thermometer,
} from 'lucide-react';
import { ScreenHeader } from './ScreenHeader';
import {
  CONVERTER_KINDS,
  convert,
  type ConverterKind,
  type ConverterUnit,
} from '../tools/converter';

export const CONVERTER_NAME = 'Unit & Base Converter';
export const CONVERTER_TITLE = 'Unit & Base';
export const CONVERTER_TAGLINE = 'UNIT & BASE CONVERTER';

interface ConverterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const KIND_ICONS: Record<
  string,
  React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>
> = {
  length: Ruler,
  mass: Scale,
  temperature: Thermometer,
  volume: FlaskConical,
  area: Square,
  speed: Gauge,
  time: Clock,
  data: HardDrive,
  'number-base': Binary,
};

function getErrorMessage(error: string): string {
  switch (error) {
    case 'not-a-number':
      return 'Enter a number';
    case 'invalid-digit':
      return 'That digit is not used in this base';
    case 'out-of-range':
      return 'That number is too large';
    case 'unknown-kind':
    case 'unknown-unit':
      return 'That conversion is not available';
    default:
      if (error.startsWith('unknown-')) {
        return 'That conversion is not available';
      }
      return '';
  }
}

export const ConverterScreen: React.FC<ConverterScreenProps> = ({ onBack, onLogoClick }) => {
  // Current measurement kind (default is first kind in list: Length)
  const [kindId, setKindId] = useState<string>(CONVERTER_KINDS[0].id);
  const currentKind: ConverterKind = useMemo(() => {
    return CONVERTER_KINDS.find((k) => k.id === kindId) ?? CONVERTER_KINDS[0];
  }, [kindId]);

  // Selected units
  const [fromUnitId, setFromUnitId] = useState<string>(CONVERTER_KINDS[0].defaultFrom);
  const [toUnitId, setToUnitId] = useState<string>(CONVERTER_KINDS[0].defaultTo);

  // User input text
  const [input, setInput] = useState<string>('');

  // Overlays / Sheets
  const [showKindSheet, setShowKindSheet] = useState(false);
  const [unitSheetTarget, setUnitSheetTarget] = useState<'from' | 'to' | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [moreUnitsExpanded, setMoreUnitsExpanded] = useState(false);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  // Active units
  const fromUnit = useMemo(() => {
    return currentKind.units.find((u) => u.id === fromUnitId) ?? currentKind.units[0];
  }, [currentKind, fromUnitId]);

  const toUnit = useMemo(() => {
    return currentKind.units.find((u) => u.id === toUnitId) ?? currentKind.units[1] ?? currentKind.units[0];
  }, [currentKind, toUnitId]);

  // Live conversion result
  const outcome = useMemo(() => {
    return convert({
      kind: currentKind.id,
      from: fromUnit.id,
      to: toUnit.id,
      input,
    });
  }, [currentKind.id, fromUnit.id, toUnit.id, input]);

  // Handlers
  const handleKindSelect = (newKind: ConverterKind) => {
    if (newKind.id !== currentKind.id) {
      setKindId(newKind.id);
      setFromUnitId(newKind.defaultFrom);
      setToUnitId(newKind.defaultTo);
      // Keep typed value only if same entry type, otherwise clear it
      if (newKind.entry !== currentKind.entry) {
        setInput('');
      }
    }
    setShowKindSheet(false);
  };

  const handleSwap = () => {
    setFromUnitId(toUnit.id);
    setToUnitId(fromUnit.id);
  };

  const handleOpenUnitSheet = (target: 'from' | 'to') => {
    setUnitSearch('');
    setMoreUnitsExpanded(false);
    setUnitSheetTarget(target);
  };

  const handleUnitSelect = (unit: ConverterUnit) => {
    if (unitSheetTarget === 'from') {
      setFromUnitId(unit.id);
    } else if (unitSheetTarget === 'to') {
      setToUnitId(unit.id);
    }
    setUnitSheetTarget(null);
  };

  const handleCopy = async () => {
    if (!outcome.ok || !outcome.value) return;
    try {
      await navigator.clipboard.writeText(outcome.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard failures are caught and shown as nothing worse than the icon not changing
    }
  };

  // Unit sheet filtering
  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return currentKind.units;
    return currentKind.units.filter(
      (u) => u.name.toLowerCase().includes(q) || u.short.toLowerCase().includes(q)
    );
  }, [currentKind.units, unitSearch]);

  const commonUnits = useMemo(() => {
    return filteredUnits.filter((u) => u.common);
  }, [filteredUnits]);

  const otherUnits = useMemo(() => {
    return filteredUnits.filter((u) => !u.common);
  }, [filteredUnits]);

  const activeSelectedUnitId = unitSheetTarget === 'from' ? fromUnit.id : toUnit.id;
  const CurrentKindIcon = KIND_ICONS[currentKind.id] ?? ArrowLeftRight;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      {/* Shared Header */}
      <ScreenHeader
        title={CONVERTER_TITLE}
        tagline={CONVERTER_TAGLINE}
        backLabel="TOOLS"
        collapsible={false}
        onBack={onBack}
        onLogoClick={onLogoClick}
      />

      {/* Body: space-y-4 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* A. Kind row */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            CONVERT
          </label>
          <button
            type="button"
            onClick={() => setShowKindSheet(true)}
            aria-label={`Current conversion kind: ${currentKind.name}. Tap to change kind.`}
            className="w-full text-left flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
          >
            <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
              <CurrentKindIcon size={24} strokeWidth={1.8} />
            </div>
            <span className="text-[15px] font-medium text-white flex-1">
              {currentKind.name}
            </span>
            <ChevronDown size={16} className="text-[#6E7075] shrink-0" />
          </button>
        </div>

        {/* B. From */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            FROM
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode={currentKind.entry === 'number' ? 'decimal' : 'text'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0"
              aria-label={`Source value in ${fromUnit.name}`}
              className="flex-1 min-w-0 bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors"
              style={{ fontSize: '16px' }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <button
              type="button"
              onClick={() => handleOpenUnitSheet('from')}
              aria-label={`Source unit, currently ${fromUnit.name}. Tap to change.`}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 min-h-[44px] shrink-0"
            >
              <span>{fromUnit.short}</span>
              <ChevronDown size={14} className="text-[#6E7075]" />
            </button>
          </div>
        </div>

        {/* C. Swap */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap source and destination units"
            className="w-11 h-11 rounded-xl bg-white/5 text-[#D0D2D6] hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowUpDown size={16} />
          </button>
        </div>

        {/* D. To */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            TO
          </label>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleOpenUnitSheet('to')}
              aria-label={`Destination unit, currently ${toUnit.name}. Tap to change.`}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 min-h-[44px] shrink-0"
            >
              <span>{toUnit.short}</span>
              <ChevronDown size={14} className="text-[#6E7075]" />
            </button>
          </div>
        </div>

        {/* E. Result panel (the one boxed element) */}
        <div className="p-4 rounded-2xl bg-[#141517] border border-white/5 space-y-3">
          {outcome.ok ? (
            <div className="text-[22px] font-medium text-white tabular-nums break-all select-all">
              {outcome.value}
            </div>
          ) : outcome.error !== 'empty' ? (
            <div className="text-[13px] text-[#E0B4A8] leading-relaxed">
              {getErrorMessage(outcome.error)}
            </div>
          ) : (
            <div className="text-[22px] font-medium text-[#686A70] tabular-nums select-none">
              0
            </div>
          )}

          {outcome.ok && outcome.example && (
            <p className="text-[11.5px] text-[#7A7C82] leading-relaxed">
              {outcome.example}
            </p>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!outcome.ok || !outcome.value}
              aria-label={copied ? 'Copied to clipboard' : 'Copy converted value'}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 min-h-[44px]"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-[#E85A3C]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* F. Kind Picker Bottom Sheet */}
      {showKindSheet && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop (NO blur) */}
          <div
            onClick={() => setShowKindSheet(false)}
            aria-label="Close measurement type picker"
            className="absolute inset-0 bg-black/60 transition-opacity"
          />

          {/* Sheet */}
          <div className="relative z-50 bg-[#141517] border-t border-white/10 rounded-t-2xl p-4 max-h-[75vh] flex flex-col">
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 shrink-0" />

            <div className="overflow-y-auto flex-1 divide-y divide-white/5">
              {CONVERTER_KINDS.map((kind) => {
                const isSelected = kind.id === currentKind.id;
                const Icon = KIND_ICONS[kind.id] ?? ArrowLeftRight;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => handleKindSelect(kind)}
                    aria-label={`Select ${kind.name}`}
                    className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                  >
                    <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                      <Icon size={24} strokeWidth={1.8} />
                    </div>
                    <span
                      className={`text-[15px] font-medium flex-1 ${
                        isSelected ? 'text-[#E85A3C]' : 'text-white'
                      }`}
                    >
                      {kind.name}
                    </span>
                    {isSelected && <Check size={18} className="text-[#E85A3C] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* F. Unit Picker Bottom Sheet */}
      {unitSheetTarget !== null && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop (NO blur) */}
          <div
            onClick={() => setUnitSheetTarget(null)}
            aria-label="Close unit picker"
            className="absolute inset-0 bg-black/60 transition-opacity"
          />

          {/* Sheet */}
          <div className="relative z-50 bg-[#141517] border-t border-white/10 rounded-t-2xl p-4 max-h-[75vh] flex flex-col">
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 shrink-0" />

            {/* Search box ONLY when kind has more than 12 units */}
            {currentKind.units.length > 12 && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#1C1D21] border border-white/10 mb-3 shrink-0">
                <Search size={15} className="text-[#7A7C82] shrink-0" />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="Search units..."
                  aria-label="Search units"
                  className="w-full bg-transparent text-sm text-white placeholder-[#686A70] focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            <div className="overflow-y-auto flex-1 divide-y divide-white/5">
              {/* If searching, show all matching units */}
              {unitSearch.trim() !== '' ? (
                filteredUnits.length > 0 ? (
                  filteredUnits.map((u) => {
                    const isSelected = u.id === activeSelectedUnitId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleUnitSelect(u)}
                        aria-label={`Select ${u.name} (${u.short})`}
                        className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                      >
                        <span
                          className={`text-[15px] font-medium ${
                            isSelected ? 'text-[#E85A3C]' : 'text-white'
                          }`}
                        >
                          {u.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[13px] font-mono text-[#7A7C82]">
                            {u.short}
                          </span>
                          {isSelected && <Check size={16} className="text-[#E85A3C]" />}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-sm text-[#7A7C82]">
                    No matching units
                  </div>
                )
              ) : (
                /* Common first, then expandable "More units" */
                <>
                  {commonUnits.map((u) => {
                    const isSelected = u.id === activeSelectedUnitId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleUnitSelect(u)}
                        aria-label={`Select ${u.name} (${u.short})`}
                        className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                      >
                        <span
                          className={`text-[15px] font-medium ${
                            isSelected ? 'text-[#E85A3C]' : 'text-white'
                          }`}
                        >
                          {u.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[13px] font-mono text-[#7A7C82]">
                            {u.short}
                          </span>
                          {isSelected && <Check size={16} className="text-[#E85A3C]" />}
                        </div>
                      </button>
                    );
                  })}

                  {otherUnits.length > 0 && !moreUnitsExpanded && (
                    <button
                      type="button"
                      onClick={() => setMoreUnitsExpanded(true)}
                      aria-label="Show more units"
                      className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer text-[#8E9094] hover:text-white min-h-[44px]"
                    >
                      <span className="text-[15px] font-medium">More units</span>
                      <ChevronDown size={16} className="text-[#6E7075]" />
                    </button>
                  )}

                  {otherUnits.length > 0 &&
                    moreUnitsExpanded &&
                    otherUnits.map((u) => {
                      const isSelected = u.id === activeSelectedUnitId;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleUnitSelect(u)}
                          aria-label={`Select ${u.name} (${u.short})`}
                          className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                        >
                          <span
                            className={`text-[15px] font-medium ${
                              isSelected ? 'text-[#E85A3C]' : 'text-white'
                            }`}
                          >
                            {u.name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[13px] font-mono text-[#7A7C82]">
                              {u.short}
                            </span>
                            {isSelected && <Check size={16} className="text-[#E85A3C]" />}
                          </div>
                        </button>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
