/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  FileText,
  Link,
  Brain,
  Activity,
  Type,
  Globe,
  Smartphone,
  Image as ImageIcon,
  Calculator,
  Timer,
  Sparkles,
  BookOpen,
  Code2,
  TrendingUp,
  ArrowLeft,
  ChevronRight,
  ArrowLeftRight,
  Video,
  Music,
  Ruler,
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import { TextCounterScreen } from './TextCounterScreen';
import { useCurrentScreen } from '../state/AxonStateContext';
import {
  searchTools,
  toolsInGroup,
  TOOL_GROUPS,
  MEDIA_SUBGROUPS,
  type CatalogTool,
  type ToolGroupId,
  type ToolTarget,
  type MediaSubgroupId,
} from '../tools/toolCatalog';

const INTERFACE_CAPTURE_ICON = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M10 3h4" />
    <path d="M10 21h4" />
    <path d="M3 10v4" />
    <path d="M21 10v4" />
  </svg>
);

/** Icons are presentation, so they live here and the catalog stays plain data. */
const TOOL_ICONS: Record<string, React.ReactNode> = {
  'text-counter': <Type size={24} strokeWidth={1.8} />,
  'interface-capture': INTERFACE_CAPTURE_ICON,
  'background-proof': <Activity size={24} strokeWidth={1.8} />,
  'content-extractor': <FileText size={24} strokeWidth={1.8} />,
  'link-analyzer': <Link size={24} strokeWidth={1.8} />,
  'ai-assistant': <Brain size={24} strokeWidth={1.8} />,
  'converter': <Ruler size={24} strokeWidth={1.8} />,
  'dictionary': <BookOpen size={24} strokeWidth={1.8} />,
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  media: <ImageIcon size={24} strokeWidth={1.8} />,
  'text-writing': <Type size={24} strokeWidth={1.8} />,
  'numbers-converters': <Calculator size={24} strokeWidth={1.8} />,
  'time-counters': <Timer size={24} strokeWidth={1.8} />,
  'create-encode': <Sparkles size={24} strokeWidth={1.8} />,
  'reading-knowledge': <BookOpen size={24} strokeWidth={1.8} />,
  'web-data': <Globe size={24} strokeWidth={1.8} />,
  code: <Code2 size={24} strokeWidth={1.8} />,
  finance: <TrendingUp size={24} strokeWidth={1.8} />,
  'device-system': <Smartphone size={24} strokeWidth={1.8} />,
  'files-convert': <ArrowLeftRight size={24} strokeWidth={1.8} />,
};

const MEDIA_ICONS: Record<MediaSubgroupId, React.ReactNode> = {
  image: <ImageIcon size={24} strokeWidth={1.8} />,
  video: <Video size={24} strokeWidth={1.8} />,
  audio: <Music size={24} strokeWidth={1.8} />,
};

// Groups whose working screens are opened by their own page, not by catalog entries.
const GROUPS_WITH_OWN_SCREENS: ReadonlySet<ToolGroupId> = new Set<ToolGroupId>(['media']);

let lastOpenedGroup: ToolGroupId | null = null;

interface AxonToolsScreenProps {
  onLogoClick: () => void;
}

export const AxonToolsScreen: React.FC<AxonToolsScreenProps> = ({
  onLogoClick,
}) => {
  // Stage 1C-i: screen navigation via state root (not prop-drilled)
  const { setCurrentScreen } = useCurrentScreen();
  const [filterQuery, setFilterQuery] = useState('');
  // Text Counter opens inside this screen; leaving Tools closes it.
  const [openTool, setOpenTool] = useState<'text-counter' | null>(null);
  // The group page being shown, or null for the home.
  const [openGroup, setOpenGroupState] = useState<ToolGroupId | null>(lastOpenedGroup);

  const setOpenGroup = (groupId: ToolGroupId | null) => {
    lastOpenedGroup = groupId;
    setOpenGroupState(groupId);
  };

  const searching = filterQuery.trim() !== '';
  const searchResults = useMemo(() => searchTools(filterQuery), [filterQuery]);
  const groupTools = useMemo(
    () => (openGroup ? toolsInGroup(openGroup) : []),
    [openGroup]
  );
  const openGroupName = openGroup
    ? TOOL_GROUPS.find((g) => g.id === openGroup)?.name ?? ''
    : '';

  const openTarget = (target: ToolTarget) => {
    if (target === 'text-counter') setOpenTool('text-counter');
    else setCurrentScreen(target);
  };

  if (openTool === 'text-counter') {
    return <TextCounterScreen onBack={() => setOpenTool(null)} onLogoClick={onLogoClick} />;
  }

  /** One tool, drawn exactly as the original simple Tools list drew it, without descriptions. */
  const renderTool = (tool: CatalogTool) => {
    const icon = TOOL_ICONS[tool.id] ?? GROUP_ICONS[tool.groupId];

    if (tool.status === 'available' && tool.opens) {
      const target = tool.opens;
      return (
        <button
          key={tool.id}
          onClick={() => openTarget(target)}
          className="w-full text-left flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
            {icon}
          </div>

          <div className="flex items-center truncate">
            <span className="text-[15px] font-sans font-medium text-white leading-tight group-hover:text-white transition-colors">
              {tool.name}
            </span>
          </div>
        </button>
      );
    }

    return (
      <div
        key={tool.id}
        className="w-full text-left flex items-center gap-4 px-2 py-3 rounded-xl cursor-default select-none"
      >
        <div className="w-9 h-9 flex items-center justify-center text-[#5A5C62] shrink-0">
          {icon}
        </div>

        <div className="flex items-center truncate">
          <span className="text-[15px] font-sans font-medium text-[#7A7C82] leading-tight">
            {tool.name}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      {/* 1. HEADER (Tree logo + "AXON" bold serif + "Tools" lighter serif) */}
      <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* AXON Tree Logo */}
            <button
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
                Tools
              </span>
            </div>
          </div>
        </div>

        {/* Small-caps tagline below */}
        <div className="pt-1 pl-1">
          <span className="text-[10px] sm:text-[10.5px] text-[#9A9B9F] tracking-widest font-sans uppercase">
            INTELLIGENCE IN MOTION · TOOL LIBRARY
          </span>
        </div>
      </header>

      {/* 2. SEARCH / FILTER BAR */}
      <div className="px-5 py-3.5 border-b border-white/5 bg-[#141517]/40 shrink-0">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#1C1D21] border border-white/10 text-xs text-white focus-within:border-white/20 transition-colors">
          <Search size={15} className="text-[#7A7C82] shrink-0" />
          <input
            type="text"
            placeholder="Filter tools..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-white placeholder-[#686A70]"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              aria-label="Clear filter"
              className="text-[#7A7C82] hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 3. BODY: search results, or one group's tools, or the calm home */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {searching ? (
          <>
            <div className="space-y-1">{searchResults.map(renderTool)}</div>
            {searchResults.length === 0 && (
              <div className="p-8 text-center text-xs text-[#707277] italic">
                No tools match &quot;{filterQuery}&quot;
              </div>
            )}
          </>
        ) : openGroup === 'media' ? (
          <>
            <button
              onClick={() => setOpenGroup(null)}
              aria-label="Back to Tools"
              className="flex items-center gap-2.5 px-2 py-2.5 mb-1 rounded-xl text-[#9A9B9F] hover:text-white hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span className="text-[11px] font-sans font-semibold uppercase tracking-widest">
                {openGroupName}
              </span>
            </button>

            <div className="space-y-1">
              {MEDIA_SUBGROUPS.map((subgroup) => (
                <button
                  key={subgroup.id}
                  onClick={() => {
                    if (subgroup.id === 'image') setCurrentScreen('image-editor');
                    else if (subgroup.id === 'video') setCurrentScreen('video-editor');
                    else if (subgroup.id === 'audio') setCurrentScreen('audio-editor');
                  }}
                  className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                    {MEDIA_ICONS[subgroup.id]}
                  </div>

                  <div className="flex-1 min-w-0 truncate">
                    <span className="text-[15px] font-sans font-medium text-white leading-tight">
                      {subgroup.name}
                    </span>
                  </div>

                  <ChevronRight size={16} className="text-[#6E7075] group-hover:text-white transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </>
        ) : openGroup ? (
          <>
            <button
              onClick={() => setOpenGroup(null)}
              aria-label="Back to Tools"
              className="flex items-center gap-2.5 px-2 py-2.5 mb-1 rounded-xl text-[#9A9B9F] hover:text-white hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span className="text-[11px] font-sans font-semibold uppercase tracking-widest">
                {openGroupName}
              </span>
            </button>
            {groupTools.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#707277] italic">
                Nothing here yet.
              </div>
            ) : (
              <div className="space-y-1">
                {groupTools.map(renderTool)}
                {groupTools.some((t) => t.status !== 'available' || !t.opens) && (
                  <div className="pt-4 pb-2 text-center text-xs text-[#707277]">
                    Dimmed tools are coming soon.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1">
              {TOOL_GROUPS.map((group) => {
                const inGroup = toolsInGroup(group.id);
                const hasAvailable =
                  GROUPS_WITH_OWN_SCREENS.has(group.id) ||
                  inGroup.some((t) => t.status === 'available');
                return (
                  <button
                    key={group.id}
                    onClick={() => setOpenGroup(group.id)}
                    className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                        hasAvailable ? 'text-[#E85A3C]' : 'text-[#5A5C62]'
                      }`}
                    >
                      {GROUP_ICONS[group.id]}
                    </div>

                    <div className="flex-1 min-w-0 truncate">
                      <span
                        className={`text-[15px] font-sans font-medium leading-tight ${
                          hasAvailable ? 'text-white' : 'text-[#9A9B9F]'
                        }`}
                      >
                        {group.name}
                      </span>
                    </div>

                    <ChevronRight size={16} className="text-[#6E7075] group-hover:text-white transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
