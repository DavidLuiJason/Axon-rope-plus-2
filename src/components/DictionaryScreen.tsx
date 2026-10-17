/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dictionary Screen (S2): AXON look and feel.
 * Word lookup, Word of the Day, Random word, Saved words, History, and private notes.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
  Shuffle,
  StickyNote,
  Sun,
  Volume2,
} from 'lucide-react';
import { ScreenHeader } from './ScreenHeader';
import { getDictionary } from '../brain/dictionaryAccess';
import { pickHeadword } from '../brain/dictionary/pickHeadword';
import { createWordBook, type WordBookStorage, type HistoryItem } from '../brain/dictionary/wordBook';
import type { LookupResult, DictEntry, DictSense } from '../brain/dictionary/types';

interface DictionaryScreenProps {
  onBack: () => void;
  onLogoClick?: () => void;
}

type DictionaryView = 'home' | 'word' | 'saved' | 'history';

function getLocalDateSeed(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DictionaryScreen: React.FC<DictionaryScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  // Persistent word book (local storage or in-memory fallback)
  const wordBook = useMemo(() => {
    let storage: WordBookStorage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    return createWordBook({ storage, clock: () => Date.now() });
  }, []);

  // View navigation
  const [view, setView] = useState<DictionaryView>('home');
  const [previousView, setPreviousView] = useState<'home' | 'saved' | 'history'>('home');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Active word details
  const [currentWord, setCurrentWord] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [expandedMeanings, setExpandedMeanings] = useState(false);

  // Saved / Note states for active word
  const [isSaved, setIsSaved] = useState(false);
  const [storedNote, setStoredNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Lists for Saved and History views
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // Headword picker state (word of day / random)
  const [pickingMode, setPickingMode] = useState<'day' | 'random' | null>(null);
  const [pickingError, setPickingError] = useState<string | null>(null);

  // Open word lookup
  const openWord = async (
    rawWord: string,
    originView: 'home' | 'saved' | 'history' = 'home'
  ) => {
    const w = rawWord.trim().toLowerCase();
    if (!w) return;

    setPreviousView(originView);
    setCurrentWord(w);
    setView('word');
    setExpandedMeanings(false);
    setLookupLoading(true);
    setLookupError(null);
    setHistoryNotice(null);
    setNoteError(null);

    try {
      const dict = await getDictionary();
      const res = await dict.lookup(w);
      setLookupResult(res);

      const targetWord = res.matches?.[0]?.word ?? w;

      if (res.found) {
        const rec = wordBook.recordLookup(targetWord);
        if (!rec.ok) {
          setHistoryNotice('Could not save this to your history.');
        }
      }

      // Check bookmark status
      const bm = wordBook.isBookmarked(targetWord);
      setIsSaved(bm.ok ? bm.value : false);

      // Check note
      const nt = wordBook.getNote(targetWord);
      const noteVal = nt.ok ? nt.note : null;
      setStoredNote(noteVal);
      setNoteInput(noteVal ?? '');
      setShowNoteEditor(Boolean(noteVal));
    } catch {
      setLookupError('The dictionary could not be opened. Try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    openWord(searchQuery, 'home');
  };

  // Pick Word of the Day or Random Word
  const handlePickWord = async (mode: 'day' | 'random') => {
    if (pickingMode !== null) return;
    setPickingMode(mode);
    setPickingError(null);

    try {
      const dict = await getDictionary();
      const seed =
        mode === 'day'
          ? getLocalDateSeed()
          : `${String(Date.now())}${Math.random()}`;
      const res = await pickHeadword({ dictionary: dict, seed, mode });
      if (res.ok) {
        openWord(res.word, 'home');
      } else {
        setPickingError('Could not find a word. Try again.');
      }
    } catch {
      setPickingError('The dictionary could not be opened. Try again.');
    } finally {
      setPickingMode(null);
    }
  };

  // Open saved list view
  const openSavedView = () => {
    const res = wordBook.listBookmarks();
    setSavedWords(res.ok ? res.bookmarks : []);
    setView('saved');
  };

  // Open history list view
  const openHistoryView = () => {
    const res = wordBook.listHistory();
    setHistoryItems(res.ok ? res.history : []);
    setView('history');
  };

  // Toggle bookmark for active word
  const handleToggleBookmark = () => {
    const targetWord = lookupResult?.matches?.[0]?.word ?? currentWord;
    if (isSaved) {
      const res = wordBook.removeBookmark(targetWord);
      if (res.ok) setIsSaved(false);
    } else {
      const res = wordBook.addBookmark(targetWord);
      if (res.ok) setIsSaved(true);
    }
  };

  // Save note
  const handleSaveNote = () => {
    setNoteError(null);
    const targetWord = lookupResult?.matches?.[0]?.word ?? currentWord;
    const res = wordBook.setNote(targetWord, noteInput);
    if (res.ok) {
      setStoredNote(noteInput);
    } else {
      if (res.error === 'note-limit') {
        setNoteError('You have reached the limit of 500 notes.');
      } else {
        setNoteError('Could not save that.');
      }
    }
  };

  // Remove note
  const handleRemoveNote = () => {
    setNoteError(null);
    const targetWord = lookupResult?.matches?.[0]?.word ?? currentWord;
    const res = wordBook.removeNote(targetWord);
    if (res.ok) {
      setStoredNote(null);
      setNoteInput('');
      setShowNoteEditor(false);
    } else {
      setNoteError('Could not remove that.');
    }
  };

  // Back button routing
  const handleBack = () => {
    if (view === 'word') {
      setView(previousView);
      if (previousView === 'saved') {
        const res = wordBook.listBookmarks();
        setSavedWords(res.ok ? res.bookmarks : []);
      } else if (previousView === 'history') {
        const res = wordBook.listHistory();
        setHistoryItems(res.ok ? res.history : []);
      }
    } else if (view !== 'home') {
      setView('home');
    } else {
      onBack();
    }
  };

  const backLabel = view === 'home' ? 'TOOLS' : 'DICTIONARY';

  // Compute matched word and entries
  const primaryMatch = lookupResult?.matches?.[0];
  const displayWord = primaryMatch?.word ?? currentWord;
  const pronunciation = primaryMatch?.entries.find(
    (e) => e.pronunciations && e.pronunciations.length > 0
  )?.pronunciations?.[0]?.text;

  // Flatten senses to calculate total count for progressive disclosure
  const allEntries: DictEntry[] = primaryMatch?.entries ?? [];
  const totalSensesCount = allEntries.reduce(
    (acc, e) => acc + (e.senses?.length ?? 0),
    0
  );

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      <ScreenHeader
        title="Dictionary"
        tagline="DICTIONARY"
        backLabel={backLabel}
        collapsible={false}
        onBack={handleBack}
        onLogoClick={onLogoClick ?? (() => {})}
      />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* ==================== HOME VIEW ==================== */}
        {view === 'home' && (
          <>
            {/* Search field in Tools-filter style */}
            <form onSubmit={handleSearchSubmit}>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#1C1D21] border border-white/10">
                <Search size={15} className="text-[#7A7C82] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Look up a word"
                  aria-label="Look up a word"
                  className="w-full bg-transparent text-sm text-white placeholder-[#686A70] focus:outline-none"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {searchQuery.trim() !== '' && (
                  <button
                    type="submit"
                    aria-label="Search"
                    className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center shrink-0 hover:bg-[#F0F0F0] cursor-pointer transition-colors"
                  >
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </form>

            {pickingError && (
              <div className="p-3.5 rounded-2xl bg-[#141517] border border-white/5 text-[13px] text-[#E0B4A8]">
                {pickingError}
              </div>
            )}

            {/* Plain rows */}
            <div className="divide-y divide-white/5 pt-1">
              {/* Word of the day */}
              <button
                type="button"
                onClick={() => handlePickWord('day')}
                aria-label="Word of the day"
                className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                  <Sun size={24} strokeWidth={1.8} />
                </div>
                <span className="text-[15px] font-medium text-white flex-1">
                  Word of the day
                </span>
                {pickingMode === 'day' ? (
                  <span className="text-[13px] text-[#8E9094]">Looking…</span>
                ) : (
                  <ChevronRight size={16} className="text-[#6E7075] shrink-0" />
                )}
              </button>

              {/* Random word */}
              <button
                type="button"
                onClick={() => handlePickWord('random')}
                aria-label="Random word"
                className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                  <Shuffle size={24} strokeWidth={1.8} />
                </div>
                <span className="text-[15px] font-medium text-white flex-1">
                  Random word
                </span>
                {pickingMode === 'random' ? (
                  <span className="text-[13px] text-[#8E9094]">Looking…</span>
                ) : (
                  <ChevronRight size={16} className="text-[#6E7075] shrink-0" />
                )}
              </button>

              {/* Saved words */}
              <button
                type="button"
                onClick={openSavedView}
                aria-label="Saved words"
                className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                  <Bookmark size={24} strokeWidth={1.8} />
                </div>
                <span className="text-[15px] font-medium text-white flex-1">
                  Saved words
                </span>
                <ChevronRight size={16} className="text-[#6E7075] shrink-0" />
              </button>

              {/* History */}
              <button
                type="button"
                onClick={openHistoryView}
                aria-label="History"
                className="w-full text-left flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                <div className="w-9 h-9 flex items-center justify-center text-[#E85A3C] shrink-0">
                  <Clock size={24} strokeWidth={1.8} />
                </div>
                <span className="text-[15px] font-medium text-white flex-1">
                  History
                </span>
                <ChevronRight size={16} className="text-[#6E7075] shrink-0" />
              </button>
            </div>

            {/* Quiet attribution footnote */}
            <div className="pt-6 text-center">
              <p className="text-[11.5px] text-[#7A7C82]">
                Meanings from Open English WordNet (CC BY 4.0).
              </p>
            </div>
          </>
        )}

        {/* ==================== WORD VIEW ==================== */}
        {view === 'word' && (
          <div className="space-y-4">
            {lookupLoading ? (
              <div className="py-8 text-center text-sm text-[#8E9094]">
                Looking up…
              </div>
            ) : lookupError ? (
              <div className="p-4 rounded-2xl bg-[#141517] border border-white/5 space-y-2">
                <p className="text-[13px] text-[#E0B4A8] leading-relaxed">
                  {lookupError}
                </p>
              </div>
            ) : lookupResult && !lookupResult.found ? (
              <div className="p-4 rounded-2xl bg-[#141517] border border-white/5 space-y-1">
                <div className="text-[15px] font-medium text-white">
                  No entry for &ldquo;{currentWord}&rdquo;.
                </div>
                <p className="text-[11.5px] text-[#7A7C82] leading-relaxed">
                  This dictionary has no place names or people.
                </p>
              </div>
            ) : lookupResult && lookupResult.found ? (
              <>
                {/* Heading & pronunciation */}
                <div className="space-y-0.5">
                  <h1 className="text-[22px] font-semibold text-white tracking-tight">
                    {displayWord}
                  </h1>
                  {pronunciation && (
                    <p className="text-[13px] text-[#8E9094]">
                      /{pronunciation}/
                    </p>
                  )}
                </div>

                {/* Action row */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleToggleBookmark}
                      aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
                      className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Bookmark
                        size={16}
                        className={isSaved ? 'text-[#E85A3C]' : ''}
                      />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNoteEditor((prev) => !prev)}
                      aria-label="Add or view note"
                      className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                    >
                      <StickyNote size={16} />
                      <span>Note</span>
                    </button>

                    <button
                      type="button"
                      disabled
                      aria-label="Listen pronunciation"
                      className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Volume2 size={16} />
                      <span>Listen</span>
                    </button>
                  </div>
                  <p className="text-[11.5px] text-[#7A7C82]">
                    Listening is coming soon.
                  </p>
                  {historyNotice && (
                    <p className="text-[11.5px] text-[#7A7C82] pt-0.5">
                      {historyNotice}
                    </p>
                  )}
                </div>

                {/* Stored Note & Note Editor */}
                {showNoteEditor && (
                  <div className="p-4 rounded-2xl bg-[#141517] border border-white/5 space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                      NOTE
                    </label>

                    {storedNote && (
                      <div className="text-[14px] text-[#ECECEC] leading-relaxed bg-[#1C1D21] border border-white/10 rounded-xl p-3.5 whitespace-pre-wrap">
                        {storedNote}
                      </div>
                    )}

                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Add a private note for this word..."
                      rows={4}
                      maxLength={1000}
                      className="w-full bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors resize-y"
                      style={{ fontSize: '16px' }}
                    />

                    {noteError && (
                      <p className="text-[13px] text-[#E0B4A8] leading-relaxed">
                        {noteError}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
                      >
                        Save note
                      </button>

                      {storedNote && (
                        <button
                          type="button"
                          onClick={handleRemoveNote}
                          className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                        >
                          Remove note
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Meanings grouped by part of speech */}
                {(() => {
                  let runningSenseIndex = 0;
                  return (
                    <div className="space-y-4 pt-1">
                      {allEntries.map((entry, entryIdx) => {
                        const entrySenses = entry.senses ?? [];
                        // Check which senses in this entry to render
                        const visibleSenses: { sense: DictSense; index: number }[] = [];
                        for (const sense of entrySenses) {
                          runningSenseIndex++;
                          if (expandedMeanings || runningSenseIndex <= 3) {
                            visibleSenses.push({
                              sense,
                              index: runningSenseIndex,
                            });
                          }
                        }

                        if (visibleSenses.length === 0) return null;

                        return (
                          <div key={entry.id ?? entryIdx} className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                              {entry.pos.toUpperCase()}
                            </label>

                            <div className="space-y-3">
                              {visibleSenses.map(({ sense, index }) => (
                                <div key={sense.synset ?? index} className="flex gap-2">
                                  <span className="text-[14px] text-[#8E9094] font-medium w-5 shrink-0 select-none">
                                    {index}.
                                  </span>
                                  <div className="space-y-1 flex-1">
                                    <p className="text-[14px] text-[#ECECEC] leading-relaxed">
                                      {sense.definition}
                                    </p>
                                    {sense.examples && sense.examples.length > 0 && (
                                      <p className="text-[13px] italic text-[#B8BABF]">
                                        &ldquo;{sense.examples[0]}&rdquo;
                                      </p>
                                    )}
                                    {sense.synonyms && sense.synonyms.length > 0 && (
                                      <p className="text-[12.5px] text-[#8E9094]">
                                        Similar: {sense.synonyms.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {totalSensesCount > 3 && !expandedMeanings && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedMeanings(true)}
                            aria-label="Show more meanings"
                            className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer text-[#8E9094] hover:text-white min-h-[44px]"
                          >
                            <span className="text-[15px] font-medium">
                              Show more meanings
                            </span>
                            <ChevronDown
                              size={16}
                              className="text-[#6E7075] shrink-0"
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : null}
          </div>
        )}

        {/* ==================== SAVED VIEW ==================== */}
        {view === 'saved' && (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              SAVED WORDS
            </label>

            {savedWords.length === 0 ? (
              <p className="text-xs text-[#707277] py-2">Nothing saved yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {savedWords.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => openWord(word, 'saved')}
                    aria-label={`Open word ${word}`}
                    className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                  >
                    <span className="text-[15px] font-medium text-white">
                      {word}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-[#6E7075] shrink-0"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== HISTORY VIEW ==================== */}
        {view === 'history' && (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              HISTORY
            </label>

            {historyItems.length === 0 ? (
              <p className="text-xs text-[#707277] py-2">No look-ups yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {historyItems.map((item) => (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => openWord(item.word, 'history')}
                    aria-label={`Open word ${item.word}`}
                    className="w-full text-left flex items-center justify-between px-2 py-3.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                  >
                    <span className="text-[15px] font-medium text-white">
                      {item.word}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] text-[#7A7C82] tabular-nums">
                        {item.count}
                      </span>
                      <ChevronRight
                        size={16}
                        className="text-[#6E7075] shrink-0"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DictionaryScreen;
