import { CONVERTER_KINDS } from '../src/tools/converter';
import { listUnits } from '../src/tools/engines/numbers/unitConvert';
/**
 * Tools tests: the grouped Tools menu data, the Text Counter run on the kernel,
 * and the registry entries for Text Tools and the Text Counter panel.
 */
import {
  TOOL_GROUPS,
  CATALOG_TOOLS,
  buildGroupViews,
  toolMatches,
  buildHome,
  toolsInGroup,
  searchTools,
  MEDIA_SUBGROUPS,
  toolsInSubgroup,
} from '../src/tools/toolCatalog';
import type { CatalogTool, ToolGroup } from '../src/tools/toolCatalog';
import { runTextCounter } from '../src/tools/textCounterRun';
import { countText, TEXT_COUNT_ACTION } from '../src/kernel/textCount';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { createTaskEngine } from '../src/kernel/taskEngine';
import type { ActionDef } from '../src/kernel/types';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerAxonToolsInterface } from '../src/interfaces/registerAxonTools';
import { getCapability } from '../src/capabilities/registry';
import { getInterface, getChildInterfaces } from '../src/interfaces/registry';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function names(views: ReturnType<typeof buildGroupViews>): string[] {
  return views.map((v) => v.group.name);
}

async function main() {
  console.log('-- groups');
  assert(TOOL_GROUPS.length === 11, 'there are exactly eleven groups (Files and Converters joined on 2026-10-15)');
  assert(new Set(TOOL_GROUPS.map((g) => g.id)).size === 11, 'group ids are unique');
  assert(
    names(buildGroupViews('')).join('|') ===
      'Media|Files and Converters|Text and Writing|Numbers|Time|Create and Encode|Language|Web and Data|AXON Code|Finance|Device and System',
    'the eleven groups appear in the decided order, with AXON Code and Finance separate'
  );
  assert(!names(buildGroupViews('')).includes('Code and Markets'), 'the old "Code and Markets" group is gone');

  console.log('-- group names and Media choices (2026-10-16)');
  assert(['Numbers', 'Time', 'Language'].every((n) => names(buildGroupViews('')).includes(n)), 'the three shortened group names are in use');
  assert(!['Numbers and Converters', 'Time and Counters', 'Reading and Knowledge'].some((n) => names(buildGroupViews('')).includes(n)), 'the three old long names are gone');
  assert(['Create and Encode', 'Device and System', 'Web and Data'].every((n) => names(buildGroupViews('')).includes(n)), 'Create and Encode, Device and System and Web and Data keep their names');
  assert(MEDIA_SUBGROUPS.map((m) => m.name).join('|') === 'Image|Video|Audio', 'Media opens on exactly Image, Video, Audio, in that order');
  const mediaTools = CATALOG_TOOLS.filter((t) => t.groupId === 'media');
  assert(mediaTools.every((t) => t.subgroup !== undefined && MEDIA_SUBGROUPS.some((m) => m.id === t.subgroup)), 'every Media tool belongs to one of the three choices');
  assert(CATALOG_TOOLS.filter((t) => t.groupId !== 'media').every((t) => t.subgroup === undefined), 'no tool outside Media has a Media choice');
  assert(toolsInSubgroup('image').map((t) => t.id).join(',') === 'image-converter,collage-maker,picture-to-table', 'Image holds Image Converter, Collage Maker, Picture to Table or Code');
  assert(toolsInSubgroup('video').map((t) => t.id).join(',') === 'video-converter,video-maker,video-downloader', 'Video holds Video Converter, Video Maker, Video Downloader');
  assert(toolsInSubgroup('audio').map((t) => t.id).join(',') === 'audio-converter,text-to-speech,voice-library,voice-cloner,speech-to-text', 'Audio holds the five sound tools');
  assert(MEDIA_SUBGROUPS.reduce((n, m) => n + toolsInSubgroup(m.id).length, 0) === mediaTools.length, 'the three choices together hold every Media tool exactly once');
  assert(CATALOG_TOOLS.length === 61, '61 tools after two converter entries are replaced by one');

  assert(CATALOG_TOOLS.filter(t=>t.id==='converter').length===1,'exactly one Converter');
  assert(CATALOG_TOOLS.find(t=>t.id==='converter')?.status==='available' && CATALOG_TOOLS.find(t=>t.id==='converter')?.opens==='converter','Converter is open and leads to its screen');
  assert(!CATALOG_TOOLS.some(t=>['Unit Converter','Number Base Converter'].includes(t.name)),'retired unit and base entries are absent');
  assert(['Currency Converter','Text Format Converter','Data Converter','Document Converter','File Converter','Image Converter','Video Converter','Audio Converter'].every(name=>CATALOG_TOOLS.some(t=>t.name===name)),'unbuilt converter families remain');
  for(const kind of CONVERTER_KINDS){
    assert(kind.defaultFrom!==kind.defaultTo && kind.units.some(u=>u.id===kind.defaultFrom) && kind.units.some(u=>u.id===kind.defaultTo),`${kind.name} defaults are valid and distinct`);
    for(const unit of kind.units)assert(kind.entry==='text'?Number.isInteger(Number(unit.id))&&Number(unit.id)>=2&&Number(unit.id)<=36:listUnits(kind.id as Parameters<typeof listUnits>[0]).some(u=>u.symbol===unit.id),`${kind.name} accepts ${unit.id}`);
  }
  console.log('-- tools');
  assert(new Set(CATALOG_TOOLS.map((t) => t.id)).size === CATALOG_TOOLS.length, 'tool ids are unique');
  assert(
    CATALOG_TOOLS.every((t) => TOOL_GROUPS.some((g) => g.id === t.groupId)),
    'every tool belongs to a known group'
  );
  assert(
    CATALOG_TOOLS.every((t) => (t.status === 'available') === (t.opens !== undefined)),
    'a tool has a target exactly when it is available'
  );
  const group = (id: string) => CATALOG_TOOLS.find((t) => t.id === id)?.groupId;
  assert(group('text-counter') === 'text-writing', 'Text Counter is in Text and Writing');
  assert(group('interface-capture') === 'web-data', 'Interface Capture is in Web and Data');
  assert(group('content-extractor') === 'web-data', 'Content Extractor is in Web and Data');
  assert(group('link-analyzer') === 'web-data', 'Link Analyzer is in Web and Data');
  assert(group('background-proof') === 'device-system', 'Background Proof is in Device and System');
  assert(group('ai-assistant') === 'device-system', 'AI Assistant is in Device and System');
  assert(CATALOG_TOOLS.length === 61, '61 tools after converter consolidation');
  assert(CATALOG_TOOLS.filter((t) => t.status === 'coming-soon').length === 58, '58 tools are honestly marked coming soon');
  assert(
    CATALOG_TOOLS.every((t) => t.name.trim() !== '' && t.description.trim() !== '' && t.description.length <= 100),
    'every tool has a name and a short description'
  );
  assert(
    TOOL_GROUPS.every((g) => CATALOG_TOOLS.some((t) => t.groupId === g.id)),
    'every group holds at least one tool'
  );
  assert(group('file-converter') === 'files-convert' && group('voice-cloner') === 'media' && group('text-to-speech') === 'media', 'the file converter and the voice tools are in their groups');
  assert(
    CATALOG_TOOLS.filter((t) => t.status === 'available').map((t) => t.id).sort().join(',') ===
      'background-proof,interface-capture,text-counter',
    'only the three real tools are marked available'
  );

  console.log('-- coming soon');
  const all = buildGroupViews('');
  const soon = (name: string) => all.find((v) => v.group.name === name)?.hasAvailable === false;
  assert(soon('Media') && soon('Numbers') && soon('Time'), 'empty groups are flagged coming soon');
  assert(soon('Create and Encode') && soon('Language'), 'more empty groups are flagged coming soon');
  assert(soon('AXON Code') && soon('Finance'), 'AXON Code and Finance are flagged coming soon');
  assert(!soon('Text and Writing') && !soon('Web and Data') && !soon('Device and System'), 'groups with a real tool are not flagged');
  assert(all.find((v) => v.group.name === 'Finance')?.tools.length === 4, 'Finance lists its four planned tools, all marked coming soon');
  assert(soon('Files and Converters'), 'Files and Converters is flagged coming soon');

  console.log('-- filtering');
  assert(names(buildGroupViews('letters')).join('|') === 'Text and Writing', 'filter "letters" keeps only Text and Writing');
  assert(buildGroupViews('letters')[0].tools.map((t) => t.id).join(',') === 'text-counter', 'filter "letters" shows only Text Counter');
  assert(names(buildGroupViews('count')).includes('Time') && names(buildGroupViews('count')).includes('Text and Writing'), 'filter "count" finds Text and Writing and Time (through Tally Counter)');
  assert(names(buildGroupViews('  CAPTURE ')).join('|') === 'Web and Data', 'filter ignores case and surrounding spaces');
  assert(buildGroupViews('zzzz-no-such-tool').length === 0, 'a filter with no match gives no groups');
  assert(buildGroupViews('   ').length === 11, 'a blank filter shows all eleven groups');
  const finance = buildGroupViews('finance');
  assert(finance.length === 1 && finance[0].group.name === 'Finance' && finance[0].hasAvailable === false && finance[0].tools.length === 4, 'a group name finds its group with all four tools, still coming soon');
  assert(buildGroupViews('web and data')[0].tools.length === 5, 'a group name match shows all of that group\'s tools');
  const onlyGroup = buildGroupViews('heartbeats');
  assert(onlyGroup.length === 1 && onlyGroup[0].tools.length === 1 && onlyGroup[0].tools[0].id === 'background-proof', 'a description match shows only the matching tool');
  assert(toolMatches(CATALOG_TOOLS[0], '') === true, 'an empty query matches every tool');
  assert(toolMatches(CATALOG_TOOLS[0], '  TEXT counter ') === true, 'toolMatches ignores case and surrounding spaces by itself');
  assert(toolMatches(CATALOG_TOOLS[0], 'no such words') === false, 'toolMatches rejects a query that is not found');

  console.log('-- the calm home: one row per group that has something to open');
  const home = buildHome();
  assert(home.rows.map((r) => r.group.name).join('|') === 'Text and Writing|Web and Data|Device and System', 'the home shows only the three groups that have a real tool');
  assert(home.rows.length < 5, 'the home never shows more rows than the old simple list had');
  assert(home.comingGroups.join('|') === 'Media|Files and Converters|Numbers|Time|Create and Encode|Language|AXON Code|Finance', 'the other eight groups are named once, in the decided order');
  assert(home.rows.length + home.comingGroups.length === TOOL_GROUPS.length, 'every group is either a row or named in the quiet line');
  const web = home.rows.find((r) => r.group.id === 'web-data');
  assert(web?.count === 5 && web.toolNames.join(', ') === 'Interface Capture, Content Extractor, Link Analyzer, JSON and Data Viewer, Web Search', 'a group row lists its tools, available ones first');
  const dev = home.rows.find((r) => r.group.id === 'device-system');
  assert(dev?.toolNames.join(', ') === 'Background Proof, AI Assistant, Device Profile, Backup and Restore', 'Device and System lists Background Proof before the coming-soon tools');
  assert(home.rows.find((r) => r.group.id === 'text-writing')?.count === 8, 'Text and Writing holds the Text Counter and seven planned tools');

  const fakeGroups: ToolGroup[] = [{ id: 'media', name: 'Media' }, { id: 'finance', name: 'Finance' }];
  const fakeTool = (id: string, groupId: 'media' | 'finance', status: 'available' | 'coming-soon'): CatalogTool => ({
    id, name: id, description: `${id} description`, groupId, status, ...(status === 'available' ? { opens: 'text-counter' as const } : {}),
  });
  const grown = buildHome(fakeGroups, [fakeTool('a', 'media', 'coming-soon'), fakeTool('b', 'media', 'available'), fakeTool('c', 'finance', 'coming-soon')]);
  assert(grown.rows.length === 1 && grown.rows[0].group.id === 'media' && grown.comingGroups.join() === 'Finance', 'a group joins the home the moment one of its tools becomes available');
  assert(grown.rows[0].toolNames.join() === 'b,a', 'the available tool is listed first in its group');
  assert(buildHome(fakeGroups, []).rows.length === 0 && buildHome(fakeGroups, []).comingGroups.length === 2, 'with no tools at all, nothing is a row');

  console.log('-- inside a group');
  assert(toolsInGroup('web-data').map((t) => t.id).join() === 'interface-capture,content-extractor,link-analyzer,json-viewer,web-search', 'a group page lists its tools, available first');
  assert(toolsInGroup('finance').length === 4 && toolsInGroup('finance').every((t) => t.status === 'coming-soon'), 'Finance holds four planned tools, none claimed as available');
  assert(toolsInGroup('text-writing')[0].id === 'text-counter', 'Text and Writing lists the available Text Counter first');

  console.log('-- search is one flat list');
  assert(searchTools('').length === 0 && searchTools('   ').length === 0, 'a blank query gives no list (the home is shown)');
  assert(searchTools('letters').map((t) => t.id).join() === 'text-counter', 'search finds a tool by its description');
  assert(searchTools('  CAPTURE ').map((t) => t.id).join() === 'interface-capture', 'search ignores case and spaces');
  assert(searchTools('web and data').length === 5, 'a group name finds every tool in that group');
  assert(searchTools('finance').length === 4, 'a group name finds its four planned tools');
  assert(['voice-library', 'voice-cloner', 'text-to-speech'].every((id) => searchTools('voice').some((t) => t.id === id)), 'search finds the voice tools');
  assert(searchTools('converter').some((t) => t.id === 'file-converter') && searchTools('converter').length >= 8, 'search for converter finds the converters');
  assert(searchTools('zzzz-no-such-tool').length === 0, 'a query with no match gives an empty list');
  assert(searchTools('link')[0].id === 'link-analyzer' && searchTools('link').some((t) => t.id === 'video-downloader'), 'search finds Link Analyzer by name, and also tools whose description mentions a link');
  assert(searchTools('count')[0].id === 'text-counter', 'search puts available tools first');

  console.log('-- Text Counter on the kernel');
  const engine = createAxonEngine();
  const sample = 'Hello brave new world\nsecond line  here';
  const run = await runTextCounter(engine, sample);
  assert(run.ok === true, 'a count succeeds');
  if (run.ok) {
    const expected = countText(sample);
    assert(JSON.stringify(run.counts) === JSON.stringify(expected), 'the counts equal countText of the exact text');
    assert(run.counts.words === 7 && run.counts.lines === 2, 'words and lines are right for the sample (7 words, 2 lines)');
    assert(/^task-\d+$/.test(run.taskId), 'the result names the task that produced it');
    assert(run.evidence.includes(run.taskId) && run.evidence.includes('COMPLETED'), 'the evidence line names the task and its state');
    assert(engine.getTask(run.taskId)?.state === 'COMPLETED', 'that task really ended COMPLETED on the engine');
    assert(engine.getTask(run.taskId)?.actionId === 'text.count', 'the task ran the text.count action');
    assert(run.ms >= 0, 'the duration is never negative');
  }
  const spaces = await runTextCounter(engine, '   ');
  assert(spaces.ok && spaces.counts.characters === 3 && spaces.counts.words === 0, 'whitespace-only text is counted, not rejected');
  const before = engine.listTasks().length;
  const empty = await runTextCounter(engine, '');
  assert(empty.ok === false, 'empty text is refused');
  assert(!empty.ok && /Nothing was run/.test(empty.message), 'the refusal says nothing was run');
  assert(engine.listTasks().length === before, 'an empty text creates no task');
  const emoji = await runTextCounter(engine, 'a\u{1F600}b');
  assert(emoji.ok && emoji.counts.characters === 3, 'characters are counted as code points');

  console.log('-- Text Counter failure paths');
  const bare = createTaskEngine();
  const unknown = await runTextCounter(bare, 'hello');
  assert(!unknown.ok && /unknown-action/.test(unknown.message), 'an engine without the action says so');
  const failing = createTaskEngine();
  const boom: ActionDef = { ...TEXT_COUNT_ACTION, run: async () => { throw new Error('disk on fire'); } };
  failing.registerAction(boom);
  const failed = await runTextCounter(failing, 'hello');
  assert(!failed.ok && /FAILED/.test(failed.message) && /disk on fire/.test(failed.message), 'a failed task is reported as failed with its error');
  assert(!failed.ok && failed.taskId !== undefined, 'a failed result still names its task');
  const odd = createTaskEngine();
  odd.registerAction({ ...TEXT_COUNT_ACTION, run: async () => ({ words: 'many' }) });
  const bad = await runTextCounter(odd, 'hello');
  assert(!bad.ok && /no counts/.test(bad.message), 'a result without real counts is never shown');

  console.log('-- registry entries');
  registerAxonToolsCapability();
  registerAxonToolsInterface();
  const cap = getCapability('cap.text-tools');
  assert(cap !== undefined && cap.displayName === 'Text Tools', 'the Text Tools capability is registered');
  assert(cap?.dataProvider === 'noUserData', 'Text Tools declares noUserData');
  assert(getCapability('cap.axon-tools') !== undefined, 'the AXON Tools capability is still registered');
  assert(getCapability('cap.axon-tools')?.dataProvider === undefined, 'AXON Tools itself makes no data claim');
  const iface = getInterface('iface.text-counter');
  assert(iface !== undefined && iface.parentId === 'iface.axon-tools', 'the Text Counter panel sits under Tools');
  assert(iface?.kind === 'panel' && iface.isNavigable === false, 'the Text Counter is a panel, not a navigation destination');
  assert(getChildInterfaces('iface.axon-tools').some((i) => i.interfaceId === 'iface.text-counter'), 'Tools lists the Text Counter as a child');
  assert(getInterface('iface.axon-tools')?.isNavigable === true, 'the Tools screen is still a navigation destination');
  let twice = false;
  try { registerAxonToolsCapability(); } catch { twice = true; }
  assert(twice, 'registering the Tools capabilities twice is refused');
  assert(TEXT_COUNT_ACTION.capabilityId === 'text-tools', 'the kernel action id still matches the registered capability name');

  console.log(`=== tools tests passed: ${checks} checks ===`);
}

let timer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error('FAIL: tools tests hung (a promise never settled)')), 10000);
});

Promise.race([main(), watchdog]).then(
  () => {
    clearTimeout(timer);
  },
  (err) => {
    clearTimeout(timer);
    console.error(err);
    throw err;
  }
);
