/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 5 — Axon Build reads live capability + interface registries.
 *
 * Status model:
 * - "registered": exists in a registry; nothing claimed about completeness
 * - "confirmed": the owner can confirm a system on this screen and that the confirmed ids are kept on this phone under the key axon.build.confirmed.v1.
 *
 * Percent complete = fraction of leaf nodes with status "confirmed".
 *
 * Test entries (cap.test-example / iface.test-example) are filtered out —
 * they are proof harnesses, not real AXON systems.
 */

import React, { useMemo, useState } from 'react';
import {
  FileText,
  Wrench,
  Settings,
  Layers,
  ChevronRight,
  ChevronDown,
  Box,
  Layout,
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import { listCapabilities } from '../capabilities/registry';
import { listInterfaces } from '../interfaces/registry';
import { describeCapability, describeInterface } from './buildDetails';
import {
  loadConfirmed,
  saveConfirmed,
  toggleConfirmed,
  type KeyValueStore,
} from '../state/buildConfirmations';

/** Build tree node status — never auto-derived from registration alone. */
export type BuildStatus = 'registered' | 'confirmed';

export interface BuildNode {
  id: string;
  name: string;
  /** Stable registry id shown as secondary label when present */
  registryId?: string;
  status: BuildStatus;
  children?: BuildNode[];
}

/**
 * Progress from confirmed leaves only. Registration does not count as done.
 */
function calculateNodeProgress(node: BuildNode): {
  completed: number;
  total: number;
  percent: number;
} {
  if (!node.children || node.children.length === 0) {
    const isDone = node.status === 'confirmed';
    return {
      completed: isDone ? 1 : 0,
      total: 1,
      percent: isDone ? 100 : 0,
    };
  }

  let completed = 0;
  let total = 0;

  for (const child of node.children) {
    if (child.children && child.children.length > 0) {
      const childProg = calculateNodeProgress(child);
      completed += childProg.completed;
      total += childProg.total;
    } else {
      total += 1;
      if (child.status === 'confirmed') {
        completed += 1;
      }
    }
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

const TEST_CAP_IDS = new Set(['cap.test-example']);
const TEST_IFACE_IDS = new Set(['iface.test-example']);

/**
 * Build tree from live registries. A leaf is status 'confirmed' when its id is in confirmedIds.
 */
function buildTreeFromRegistries(confirmedIds: Set<string>): BuildNode[] {
  const caps = listCapabilities().filter((c) => !TEST_CAP_IDS.has(c.id));
  const ifaces = listInterfaces().filter((i) => !TEST_IFACE_IDS.has(i.interfaceId));

  const capabilityChildren: BuildNode[] = caps.map((c) => ({
    id: c.id,
    name: c.displayName,
    registryId: c.id,
    status: confirmedIds.has(c.id) ? ('confirmed' as const) : ('registered' as const),
  }));

  const interfaceChildren: BuildNode[] = ifaces.map((i) => ({
    id: i.interfaceId,
    name: i.displayName,
    registryId: i.interfaceId,
    status: confirmedIds.has(i.interfaceId) ? ('confirmed' as const) : ('registered' as const),
  }));

  return [
    {
      id: 'group-capabilities',
      name: 'Capabilities',
      status: 'registered',
      children: capabilityChildren,
    },
    {
      id: 'group-interfaces',
      name: 'Interfaces',
      status: 'registered',
      children: interfaceChildren,
    },
  ];
}

interface AxonBuildScreenProps {
  onLogoClick: () => void;
}

const getLocalStorage = (): KeyValueStore | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const AxonBuildScreen: React.FC<AxonBuildScreenProps> = ({ onLogoClick }) => {
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => {
    return loadConfirmed(getLocalStorage());
  });

  const tree = useMemo(() => buildTreeFromRegistries(confirmedIds), [confirmedIds]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const allCaps = useMemo(() => listCapabilities(), []);
  const allIfaces = useMemo(() => listInterfaces(), []);
  const capMap = useMemo(() => new Map(allCaps.map((c) => [c.id, c])), [allCaps]);
  const ifaceMap = useMemo(
    () => new Map(allIfaces.map((i) => [i.interfaceId, i])),
    [allIfaces]
  );

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleConfirm = (id: string) => {
    setConfirmedIds((prev) => {
      const next = toggleConfirmed(prev, id);
      saveConfirmed(getLocalStorage(), next);
      return next;
    });
  };

  const renderTopLevelIcon = (id: string) => {
    switch (id) {
      case 'group-capabilities':
        return <Box size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
      case 'group-interfaces':
        return <Layout size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
      case 'cap.settings':
      case 'iface.settings':
        return <Settings size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
      case 'cap.axon-source':
      case 'iface.axon-source':
        return <FileText size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
      case 'cap.axon-tools':
      case 'iface.axon-tools':
        return <Wrench size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
      case 'cap.interface-capture':
      case 'iface.interface-capture':
        return (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#E0E2E6]"
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
      default:
        return <Layers size={22} strokeWidth={1.8} className="text-[#E0E2E6]" />;
    }
  };

  const statusLabel = (status: BuildStatus) =>
    status === 'confirmed' ? 'confirmed' : 'registered';

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      {/* HEADER */}
      <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                Build
              </span>
            </div>
          </div>
        </div>
        <div className="pt-1 pl-1">
          <span className="text-[10px] sm:text-[10.5px] text-[#9A9B9F] tracking-widest font-sans uppercase">
            INTELLIGENCE IN MOTION · LIVE REGISTRY
          </span>
        </div>
      </header>

      {/* TREE */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-10 space-y-1">
        <p className="px-2 pt-3 pb-3 text-[12.5px] text-[#7A7C82] leading-relaxed max-w-xl">
          Live registry view. Status is &quot;registered&quot; until you explicitly confirm a
          system is complete — registration alone never marks something built.
        </p>

        {tree.map((node: BuildNode) => {
          const isExpanded = expandedNodes.has(node.id);
          const hasChildren = Boolean(node.children && node.children.length > 0);
          const prog = calculateNodeProgress(node);

          return (
            <div key={node.id} className="rounded-2xl">
              {/* Top-level row */}
              <button
                type="button"
                onClick={() => hasChildren && toggleNode(node.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#1C1D20] border border-white/5 flex items-center justify-center shrink-0">
                    {renderTopLevelIcon(node.id)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-serif text-[17px] font-normal text-[#EAEAEA] tracking-wide leading-tight truncate">
                      {node.name}
                    </span>
                    <span className="text-[12px] text-[#7A7C82] font-sans mt-0.5 leading-tight">
                      {prog.completed} / {prog.total} confirmed · {prog.percent}%
                    </span>
                    <div className="mt-2 w-48 sm:w-64 h-[3px] bg-[#232428] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E85A3C] rounded-full transition-all duration-300"
                        style={{ width: `${prog.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-[#5A5C62]">
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </div>
              </button>

              {/* Children */}
              {hasChildren && isExpanded && (
                <div className="ml-8 sm:ml-10 pl-4 border-l border-white/10 space-y-0.5 pb-2">
                  {node.children!.map((child) => {
                    const childHasChildren = Boolean(
                      child.children && child.children.length > 0
                    );
                    const childExpanded = expandedNodes.has(child.id);
                    const childProg = calculateNodeProgress(child);
                    const isConfirmed = child.status === 'confirmed';

                    const cap = capMap.get(child.id);
                    const iface = ifaceMap.get(child.id);
                    const detailView = cap
                      ? describeCapability(cap)
                      : iface
                      ? describeInterface(iface, allIfaces)
                      : null;

                    return (
                      <div key={child.id}>
                        <button
                          type="button"
                          onClick={() => toggleNode(child.id)}
                          className="relative w-full flex items-center justify-between gap-3 px-2 py-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left"
                        >
                          <div className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-4 h-px bg-white/10" />

                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                                isConfirmed
                                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
                                  : 'bg-[#55575D]'
                              }`}
                              title={statusLabel(child.status)}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-serif text-[15.5px] font-normal text-[#E0E2E6] tracking-wide leading-tight truncate">
                                {child.name}
                              </span>
                              {child.registryId && (
                                <span className="text-[11px] text-[#5A5C62] font-mono mt-0.5 truncate">
                                  {child.registryId}
                                </span>
                              )}
                              <span className="text-[11.5px] text-[#7A7C82] font-sans mt-0.5 leading-tight">
                                {statusLabel(child.status)}
                                {childHasChildren
                                  ? ` · ${childProg.completed} / ${childProg.total} confirmed`
                                  : ''}
                              </span>
                              {childHasChildren && (
                                <div className="mt-2 w-44 sm:w-60 h-[3px] bg-[#232428] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#E85A3C] rounded-full transition-all duration-300"
                                    style={{ width: `${childProg.percent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 ml-4 text-[#5A5C62]">
                            {childExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </div>
                        </button>

                        {/* Detail panel */}
                        {childExpanded && detailView && (
                          <div className="ml-5 mb-2 rounded-xl bg-[#1C1D20] border border-white/5 px-3.5 py-3 space-y-2 font-sans">
                            {detailView.sections.map((section) => (
                              <div key={section.label} className="space-y-1">
                                <span className="text-[10px] tracking-widest uppercase text-[#9A9B9F] block">
                                  {section.label}
                                </span>
                                {section.lines.map((line, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[12.5px] text-[#E0E2E6] leading-snug"
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ))}
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleConfirm(child.id)}
                                className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 active:scale-95 transition-all text-[12.5px] text-[#ECECEC]"
                              >
                                {isConfirmed ? 'Remove confirmation' : 'Mark as confirmed'}
                              </button>
                              <div className="text-[12px] text-[#7A7C82] mt-1.5">
                                Confirmed means you marked it complete. AXON does not check it.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
