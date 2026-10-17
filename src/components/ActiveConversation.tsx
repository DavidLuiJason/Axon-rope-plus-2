/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  Share2, 
  MoreVertical, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useChatSession } from '../state/AxonStateContext';
import type { ChatMessage } from '../types';

interface ActiveConversationProps {
  onSelectSuggestion: (prompt: string) => void;
}

/**
 * Long words, links and pasted code must wrap inside the bubble instead of
 * spilling out of it.
 */
const WRAP = 'min-w-0 max-w-full [overflow-wrap:anywhere] break-words';

/**
 * Each message is its own memoised row, so typing in the composer does not
 * redraw the whole history. The browser may skip drawing rows that are far
 * off screen (content-visibility), which keeps fast scrolling in long chats
 * light.
 */
const ROW_PERF = '[content-visibility:auto] [contain-intrinsic-size:auto_96px]';

/**
 * A message the user sent is shown in full only when it is short. Past
 * either limit it is cut to a few lines and a "Show all" button opens the
 * rest. The test reads the text only, so no measuring on screen is needed.
 */
const LONG_MESSAGE_CHARS = 300;
const LONG_MESSAGE_BREAKS = 6;

function isLongMessage(text: string): boolean {
  if (text.length > LONG_MESSAGE_CHARS) return true;
  let breaks = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      breaks++;
      if (breaks >= LONG_MESSAGE_BREAKS) return true;
    }
  }
  return false;
}

interface MessageRowProps {
  msg: ChatMessage;
  onSelectSuggestion: (prompt: string) => void;
}

const MessageRow = React.memo(function MessageRow({ msg, onSelectSuggestion }: MessageRowProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === 'user') {
    const long = isLongMessage(msg.content);
    return (
      <div className={`flex justify-end ${ROW_PERF}`}>
        {/* No max-w-full here: it would fight max-w-[85%] and let the bubble
            grow to the full row width. The bubble hugs its text. */}
        <div className="min-w-0 [overflow-wrap:anywhere] break-words bg-[#242528] text-[#ECECEC] text-[15px] leading-relaxed rounded-[22px] rounded-tr-[6px] px-4.5 py-3.5 max-w-[85%] sm:max-w-[78%] shadow-sm border border-white/[0.04]">
          <p className={`${WRAP} whitespace-pre-wrap ${long && !expanded ? 'line-clamp-5' : ''}`}>{msg.content}</p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1.5 py-1 text-[13px] font-medium text-[#A0A2A7] hover:text-white active:text-white transition-colors"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Assistant (AXON) message
  return (
    <div className={`flex flex-col space-y-4 ${ROW_PERF}`}>
      {/* Main response typography rendered directly on canvas */}
      <div className={`${WRAP} text-[#ECECEC] text-[15px] leading-[1.65] font-normal space-y-3.5 pt-1`}>
        {msg.leadParagraph ? (
          <p className={WRAP}>{msg.leadParagraph}</p>
        ) : (
          <p className={`${WRAP} whitespace-pre-wrap`}>{msg.content}</p>
        )}

        {msg.planIntro && (
          <p className={`${WRAP} pt-1`}>{msg.planIntro}</p>
        )}

        {/* Numbered plan list */}
        {msg.planItems && msg.planItems.length > 0 && (
          <ol className="space-y-2.5 pt-1 pl-1 list-none">
            {msg.planItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-[#E6E8EB]">
                <span className="font-mono text-sm text-[#A0A2A7] shrink-0 pt-0.5">
                  {idx + 1}.
                </span>
                <span className={WRAP}>{item}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Action Bar (Sources pill, copy, share, overflow) */}
      <div className="flex items-center justify-end gap-1.5 pt-2 select-none">
        {/* Sources Pill Button */}
        {msg.hasSources && (
          <button
            onClick={() => setShowSources((v) => !v)}
            aria-label="View sources"
            className="h-7 px-3 rounded-full bg-[#232427] hover:bg-[#2C2D32] text-xs font-medium text-[#C4C6CA] hover:text-white flex items-center gap-1.5 border border-white/5 transition-colors mr-1"
          >
            <FileText size={13} strokeWidth={2} />
            <span>Sources</span>
          </button>
        )}

        {/* Copy Button */}
        <button
          onClick={() => handleCopy(msg.content)}
          aria-label="Copy message text"
          title="Copy message"
          className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
        >
          {copied ? (
            <Check size={15} className="text-emerald-400" />
          ) : (
            <Copy size={15} strokeWidth={2} />
          )}
        </button>

        {/* Share Button */}
        <button
          onClick={() => navigator.clipboard?.writeText(msg.content)}
          aria-label="Share response"
          title="Share response"
          className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
        >
          <Share2 size={15} strokeWidth={2} />
        </button>

        {/* More Vertical */}
        <button
          aria-label="More options"
          title="More options"
          className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
        >
          <MoreVertical size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Sources drawer disclosure */}
      {showSources && (
        <div className="p-3 bg-[#1C1D21] border border-white/10 rounded-2xl text-xs space-y-1.5">
          <div className="font-semibold text-white/90">Referenced Architectural Sources:</div>
          <div className="text-[#A0A2A7] flex items-center gap-1.5 hover:text-white cursor-pointer">
            <ExternalLink size={12} />
            <span>Official AXON Design Specifications &bull; Section 4 (Anchored Viewport)</span>
          </div>
          <div className="text-[#A0A2A7] flex items-center gap-1.5 hover:text-white cursor-pointer">
            <ExternalLink size={12} />
            <span>Android Modern Architecture Guidelines &bull; Jetpack Compose &amp; Kotlin Clean Code</span>
          </div>
        </div>
      )}

      {/* Contextual Suggestion Prompt Card (Image 2) */}
      {msg.suggestionPrompt && (
        <button
          type="button"
          onClick={() => onSelectSuggestion(msg.suggestionPrompt!)}
          className="group w-full text-left bg-[#1F2023] hover:bg-[#25262A] rounded-2xl p-4 border border-white/[0.05] hover:border-white/10 flex items-start gap-3 transition-all shadow-md active:scale-[0.99]"
        >
          {/* 4-point star icon matching Image 2 */}
          <div className="text-white/70 group-hover:text-white shrink-0 mt-0.5">
            <Sparkles size={16} strokeWidth={1.8} />
          </div>
          <p className={`${WRAP} text-[14px] text-[#D8DADC] group-hover:text-white font-normal italic leading-relaxed`}>
            {msg.suggestionPrompt}
          </p>
        </button>
      )}
    </div>
  );
});

export const ActiveConversation: React.FC<ActiveConversationProps> = ({
  onSelectSuggestion,
}) => {
  const { messages } = useChatSession();

  // App hands over a new function on every keystroke. Rows get one steady
  // function that always calls the newest one, so they can stay memoised.
  const latestSelect = useRef(onSelectSuggestion);
  latestSelect.current = onSelectSuggestion;
  const steadySelect = useCallback((prompt: string) => latestSelect.current(prompt), []);

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 sm:px-6 pt-2 pb-8 space-y-6">
      {messages.map((msg) => (
        <MessageRow key={msg.id} msg={msg} onSelectSuggestion={steadySelect} />
      ))}
    </div>
  );
};
