/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import { getDictionary } from '../brain/dictionaryAccess';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  const [credit, setCredit] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [checkText, setCheckText] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getDictionary();
        const info = d.info();
        const text = await d.attribution();
        if (!alive) return;
        setSummary(`${info.label} ${info.version}: ${info.entries.toLocaleString()} entries, ${info.senses.toLocaleString()} meanings`);
        setCredit(text.trim());
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'unknown error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setCheckText('');
    try {
      const started = performance.now();
      const d = await getDictionary();
      const found = await d.lookup('running');
      const run = found.matches.find((m) => m.word === 'run');
      const def = run?.entries[0]?.senses[0]?.definition ?? '';
      const ms = Math.round(performance.now() - started);
      setCheckText(
        run
          ? `"running" is read as "run" (${run.rule ?? 'rule'}). Meaning: ${def}. Took ${ms} ms.`
          : `The check did not find "run". Took ${ms} ms.`,
      );
    } catch (e) {
      setCheckText(`The check failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#18191C] border border-white/10 rounded-3xl p-6 shadow-2xl text-[#ECECEC] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <BookOpen size={18} className="text-[#E85A3C]" />
            <h2 className="font-serif text-lg font-semibold tracking-wide text-white">Credits</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close credits"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A2A7] hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {error ? (
          <p className="text-[12px] text-[#E85A3C] leading-relaxed">The dictionary could not be opened: {error}</p>
        ) : (
          <>
            <p className="text-xs font-medium text-white">{summary || 'Opening the dictionary...'}</p>
            <p className="text-[12px] text-[#9A9B9F] leading-relaxed whitespace-pre-wrap">{credit}</p>
          </>
        )}

        <div className="space-y-2 pt-1">
          <button
            onClick={runCheck}
            disabled={checking}
            className="w-full p-3 bg-[#141517] hover:bg-[#1E1F23] rounded-2xl border border-white/5 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Check the dictionary'}
          </button>
          {checkText && <p className="text-[11.5px] text-[#9A9B9F] leading-relaxed">{checkText}</p>}
        </div>
      </div>
    </div>
  );
};
