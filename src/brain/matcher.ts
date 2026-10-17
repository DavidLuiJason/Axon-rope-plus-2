/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The flexible matcher (Tier 1). Commands declare keywords and a reading
 * function; the matcher builds an index from keyword to commands once, so a
 * message only reaches the few commands that share a word with it and the
 * cost does not grow with the number of registered tools.
 */

import type { CommandDef, Understanding } from './types';

/** At or above this score the command runs. */
export const RUN_AT = 0.8;
/** From here up to RUN_AT the Brain asks "Did you mean". Below it the message is passed on. */
export const ASK_AT = 0.5;

export interface Reading extends Understanding {
  command: CommandDef;
}

export interface Matcher {
  /** How many commands are indexed. */
  size: number;
  find(message: string): Reading | null;
}

export function tokens(message: string): string[] {
  return message.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function createMatcher(commands: CommandDef[]): Matcher {
  const index = new Map<string, CommandDef[]>();
  let size = 0;
  for (const command of commands) {
    if (!command.understand || !command.keywords) continue;
    size += 1;
    for (const word of command.keywords) {
      const key = word.toLowerCase();
      const list = index.get(key);
      if (!list) index.set(key, [command]);
      else if (!list.includes(command)) list.push(command);
    }
  }

  return {
    size,
    find(message: string): Reading | null {
      const seen = new Set<CommandDef>();
      let best: Reading | null = null;
      for (const token of new Set(tokens(message))) {
        for (const command of index.get(token) ?? []) {
          if (seen.has(command)) continue;
          seen.add(command);
          const read = command.understand;
          if (!read) continue;
          const u = read.call(command, message);
          if (u && u.score >= ASK_AT && (!best || u.score > best.score)) best = { ...u, command };
        }
      }
      return best;
    },
  };
}
