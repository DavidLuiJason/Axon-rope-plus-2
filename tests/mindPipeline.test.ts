/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 pipeline order, compatibility, trace and legacy-boundary tests.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createMind, LEGACY_REGISTER, createLegacyExecutor } from '../src/brain/mind';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext } from '../src/brain/mind';
import type { BrainProvider, BrainReply, BrainRequest, SourceStatus } from '../src/brain/types';
import { getAxonBrain } from '../src/brain';
import { PLANNED_SOURCES } from '../src/brain/brain';

let checks = 0;
function assert(ok: boolean, message: string): void { checks++; if (!ok) throw new Error(`FAIL: ${message}`); }
function provider(id: string, handle: (request: BrainRequest) => Promise<BrainReply | null>, holds = false): BrainProvider {
  return { id, label: id, status: (): SourceStatus => ({ id, label: id, ready: true, note: '' }), holdsConversation: () => holds, handle };
}
const answer = (content: string, source: string): BrainReply => ({ content, source });

async function main(): Promise<void> {
  const calls: string[] = [];
  const p = provider('test-provider', async (request) => { calls.push(request.text); return answer('ok', 'test-provider'); });
  const brain = createMind({ providers: [p], fallback: provider('test-fallback', async () => answer('fallback', 'test-fallback')), now: () => 123 });
  for (const message of ['ordinary message', '']) {
    const result = await brain.askWithTrace({ text: message, place: 'chat' });
    assert(result.trace.entries.map((entry) => entry.stage).join(',') === 'intake,reading,analysis,meaning,resolution,dialogue,planning,execution,verification,response', `all stages run in order for ${JSON.stringify(message)}`);
    assert(result.trace.utterance.text === message && result.trace.utterance.at === 123, `utterance captures ${JSON.stringify(message)}`);
  }
  const direct = await brain.ask({ text: 'ask equality', place: 'chat' });
  const traced = await brain.askWithTrace({ text: 'ask equality', place: 'chat' });
  assert(JSON.stringify(direct) === JSON.stringify(traced.reply), 'ask equals askWithTrace reply');
  assert(brain.sources().connected[0]?.id === 'test-provider', 'sources keeps the connected-provider shape');
  assert(JSON.stringify(brain.sources().planned) === JSON.stringify(PLANNED_SOURCES), 'sources keeps the planned-source list when no override is passed');

  const throwingClockBrain = createMind({
    providers: [provider('still-answers', async () => answer('reply survived', 'still-answers'))],
    fallback: provider('fallback', async () => answer('fallback', 'fallback')),
    now: () => { throw new Error('clock failure'); },
  });
  const failedStage = await throwingClockBrain.askWithTrace({ text: 'safe despite stage error', place: 'chat' });
  assert(failedStage.trace.entries.some((entry) => entry.stage === 'intake' && entry.note === 'stage failed: clock failure'), 'stage failure is recorded');
  assert(failedStage.reply.content === 'reply survived', 'reply is still produced after a stage failure');

  const skipped: string[] = [];
  const thrower = provider('throws', async () => { skipped.push('throws'); throw new Error('provider failure'); });
  const survivor = provider('survivor', async () => { skipped.push('survivor'); return answer('survived', 'survivor'); });
  const providerBrain = createMind({ providers: [thrower, survivor], fallback: provider('fallback', async () => answer('fallback', 'fallback')) });
  assert((await providerBrain.ask({ text: 'provider check', place: 'chat' })).source === 'survivor', 'throwing provider is skipped');
  assert(skipped.join(',') === 'throws,survivor', 'providers are tried in order after a throw');

  const holderCalls: string[] = [];
  const normal = provider('normal', async () => { holderCalls.push('normal'); return answer('wrong', 'normal'); });
  const holder = provider('holder', async () => { holderCalls.push('holder'); return answer('follow-up', 'holder'); }, true);
  const followUpBrain = createMind({ providers: [normal, holder], fallback: provider('fallback', async () => answer('fallback', 'fallback')) });
  assert((await followUpBrain.ask({ text: 'follow-up answer', place: 'chat' })).source === 'holder', 'open follow-up holder answers first');
  assert(holderCalls.join(',') === 'holder', 'holder response prevents later provider calls');

  const trace = (await brain.askWithTrace({ text: 'trace states', place: 'chat' })).trace.entries;
  for (const id of ['resolution', 'dialogue', 'planning', 'verification']) assert(trace.find((entry) => entry.stage === id)?.state === 'not-built', `${id} is not built in B1`);
  assert(trace.find((entry) => entry.stage === 'meaning')?.state === 'not-built', 'meaning is not built in B1');
  assert(trace.find((entry) => entry.stage === 'execution')?.state === 'ran', 'execution runs the legacy executor');

  const codeExecutor = createLegacyExecutor([provider('code', async () => answer('ok', 'code'))], provider('fallback', async () => answer('fallback', 'fallback')));
  const stages = createStages(codeExecutor, () => 1, () => 'test-utterance');
  let codeContext: MindContext = { utterance: { id: '', text: 'count the words in: git status', place: 'chat', at: 0 }, entries: [] };
  codeContext = await stages[0].run(codeContext);
  codeContext = await stages[1].run(codeContext);
  assert(codeContext.analysis?.segments.some((segment) => segment.kind === 'material' && segment.text === 'git status') === true, 'code payload is represented by a material segment');
  let quotedContext: MindContext = { utterance: { id: '', text: 'count words in \"leave these words alone\"', place: 'chat', at: 0 }, entries: [] };
  quotedContext = await stages[0].run(quotedContext);
  quotedContext = await stages[1].run(quotedContext);
  assert(quotedContext.analysis?.segments.some((segment) => segment.kind === 'material' && segment.text === '\"leave these words alone\"') === true, 'quoted payload is represented by a material segment');
  codeContext = await stages[2].run(codeContext);
  codeContext = await stages[3].run(codeContext);
  assert(codeContext.frame?.act === 'unknown' && codeContext.frame.confidence === 0, 'B1 meaning frame stays unknown with zero confidence');

  const realIds = getAxonBrain().sources().connected.map((item) => item.id);
  assert(realIds.every((id) => LEGACY_REGISTER.some((entry) => entry.providerId === id)), 'every real provider and fallback has a legacy register entry');
  assert(LEGACY_REGISTER.every((entry) => realIds.includes(entry.providerId)), 'legacy register has no unknown provider id');

  const mindRoot = 'src/brain/mind';
  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, item.name);
      if (item.isDirectory()) out.push(...await walk(full));
      else if (item.name.endsWith('.ts')) out.push(full);
    }
    return out;
  }
  for (const file of await walk(mindRoot)) {
    const text = await readFile(file, 'utf8');
    assert(!hasRegexLiteral(text), `no regex literal in ${file}`);
    assert(!hasUserPhrase(text), `no fixed user phrase in ${file}`);
  }
  console.log(`B1 mind pipeline tests passed: ${checks} checks`);
}

function hasRegexLiteral(source: string): boolean {
  let quote = '';
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '/') return true;
  }
  return false;
}

function hasUserPhrase(source: string): boolean {
  const literals = source.match(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g) ?? [];
  const starts = ['hello', 'help', 'what ', 'tell me', 'make ', 'count ', 'define ', 'remember that', 'forget ', 'download ', 'meaning of', 'how many', 'could you', 'can you'];
  return literals.some((literal) => {
    const body = literal.slice(1, -1).replace(/\\./g, ' ');
    const words = body.trim().split(/\s+/).filter(Boolean);
    return words.length > 3 && starts.some((start) => body.toLowerCase().startsWith(start));
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
