/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Tools menu as data: eleven groups and the tools inside them (the complete planned menu).
 * Pure data and pure functions. No React, no icons: the screen decides how to draw.
 * The Tools home shows one calm row per group that has something to open; groups with
 * nothing yet are named once in a quiet line, never as a wall of "Coming soon" badges.
 */

export type ToolGroupId =
  | 'media'
  | 'files-convert'
  | 'text-writing'
  | 'numbers-converters'
  | 'time-counters'
  | 'create-encode'
  | 'reading-knowledge'
  | 'web-data'
  | 'code'
  | 'finance'
  | 'device-system';

export interface ToolGroup {
  id: ToolGroupId;
  name: string;
}

/** Media opens on three choices; each tool in Media belongs to exactly one. */
export type MediaSubgroupId = 'image' | 'video' | 'audio';

export interface MediaSubgroup {
  id: MediaSubgroupId;
  name: string;
}

export const MEDIA_SUBGROUPS: readonly MediaSubgroup[] = [
  { id: 'image', name: 'Image' },
  { id: 'video', name: 'Video' },
  { id: 'audio', name: 'Audio' },
];

/** Where an available tool leads. */
export type ToolTarget = 'interface-capture' | 'background-proof' | 'text-counter' | 'converter' | 'dictionary';

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  groupId: ToolGroupId;
  /** Present exactly for the tools in the Media group. */
  subgroup?: MediaSubgroupId;
  status: 'available' | 'coming-soon';
  /** Present exactly when status is "available". */
  opens?: ToolTarget;
}

export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: 'media', name: 'Media' },
  { id: 'files-convert', name: 'Files and Converters' },
  { id: 'text-writing', name: 'Text and Writing' },
  { id: 'numbers-converters', name: 'Numbers' },
  { id: 'time-counters', name: 'Time' },
  { id: 'create-encode', name: 'Create and Encode' },
  { id: 'reading-knowledge', name: 'Language' },
  { id: 'web-data', name: 'Web and Data' },
  { id: 'code', name: 'AXON Code' },
  { id: 'finance', name: 'Finance' },
  { id: 'device-system', name: 'Device and System' },
];

export const CATALOG_TOOLS: readonly CatalogTool[] = [
  {
    id: 'text-counter',
    name: 'Text Counter',
    description: 'Count the words, characters, letters and lines of any text.',
    groupId: 'text-writing',
    status: 'available',
    opens: 'text-counter',
  },
  {
    id: 'interface-capture',
    name: 'Interface Capture',
    description: "Capture and export AXON's real interfaces.",
    groupId: 'web-data',
    status: 'available',
    opens: 'interface-capture',
  },
  {
    id: 'content-extractor',
    name: 'Content Extractor',
    description: 'Extract and organize useful content.',
    groupId: 'web-data',
    status: 'coming-soon',
  },
  {
    id: 'link-analyzer',
    name: 'Link Analyzer',
    description: 'Analyze links and detect what they lead to.',
    groupId: 'web-data',
    status: 'coming-soon',
  },
  {
    id: 'background-proof',
    name: 'Background Proof',
    description: 'Prove background execution with native heartbeats while the app is closed.',
    groupId: 'device-system',
    status: 'available',
    opens: 'background-proof',
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: "Get help from AXON's AI.",
    groupId: 'device-system',
    status: 'coming-soon',
  },
  {
    id: 'image-converter',
    name: 'Image Converter',
    description: 'Convert pictures between PNG, JPG, WebP and SVG.',
    groupId: 'media',
    subgroup: 'image',
    status: 'coming-soon',
  },
  {
    id: 'collage-maker',
    name: 'Collage Maker',
    description: 'Make a collage from pictures, with a style choice.',
    groupId: 'media',
    subgroup: 'image',
    status: 'coming-soon',
  },
  {
    id: 'picture-to-table',
    name: 'Picture to Table or Code',
    description: 'Turn a picture into a table (CSV) or a drawing (SVG).',
    groupId: 'media',
    subgroup: 'image',
    status: 'coming-soon',
  },
  {
    id: 'audio-converter',
    name: 'Audio Converter',
    description: 'Convert sound files between formats.',
    groupId: 'media',
    subgroup: 'audio',
    status: 'coming-soon',
  },
  {
    id: 'text-to-speech',
    name: 'Text to Speech',
    description: 'Read any text aloud in a voice you choose.',
    groupId: 'media',
    subgroup: 'audio',
    status: 'coming-soon',
  },
  {
    id: 'voice-library',
    name: 'Voice Library',
    description: 'Many voices, with pitch, speed, style and emotion you can adjust.',
    groupId: 'media',
    subgroup: 'audio',
    status: 'coming-soon',
  },
  {
    id: 'voice-cloner',
    name: 'Voice Cloner',
    description: 'Clone a voice you have permission to use, with adjustable speech patterns.',
    groupId: 'media',
    subgroup: 'audio',
    status: 'coming-soon',
  },
  {
    id: 'speech-to-text',
    name: 'Speech to Text',
    description: 'Turn speech or audio into text.',
    groupId: 'media',
    subgroup: 'audio',
    status: 'coming-soon',
  },
  {
    id: 'video-converter',
    name: 'Video Converter',
    description: 'Convert video between formats.',
    groupId: 'media',
    subgroup: 'video',
    status: 'coming-soon',
  },
  {
    id: 'video-maker',
    name: 'Video Maker',
    description: 'Turn a finished edit into a video.',
    groupId: 'media',
    subgroup: 'video',
    status: 'coming-soon',
  },
  {
    id: 'video-downloader',
    name: 'Video Downloader',
    description: 'Download a video you have the right to keep from a link.',
    groupId: 'media',
    subgroup: 'video',
    status: 'coming-soon',
  },
  {
    id: 'file-converter',
    name: 'File Converter',
    description: 'Convert a file from one format to another.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'zip-tool',
    name: 'Zip and Unzip',
    description: 'Pack files into a zip, or open one.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'pdf-tools',
    name: 'PDF Tools',
    description: 'Make, read, merge and split PDF files.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'text-format-converter',
    name: 'Text Format Converter',
    description: 'Convert between plain text, Markdown, HTML, JSON and CSV.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'data-converter',
    name: 'Data Converter',
    description: 'Convert tables and data between CSV, JSON, YAML and spreadsheets.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'document-converter',
    name: 'Document Converter',
    description: 'Convert Word and similar documents to text, PDF or Markdown.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'batch-convert',
    name: 'Batch Convert',
    description: 'Convert many files in one go.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  {
    id: 'file-inspector',
    name: 'File Inspector',
    description: 'Show a file\'s type, size and a summary of what is inside.',
    groupId: 'files-convert',
    status: 'coming-soon',
  },
  { id: 'converter', name: 'Unit & Base Converter', description: 'Convert lengths, weights, temperatures and other units, and number bases.', groupId: 'files-convert', status: 'available', opens: 'converter' },
  {
    id: 'find-replace',
    name: 'Find and Replace',
    description: 'Find text and replace it, with a preview first.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'case-converter',
    name: 'Case Converter',
    description: 'Change text to upper, lower, title or sentence case.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'text-cleaner',
    name: 'Text Cleaner',
    description: 'Remove extra spaces, blank lines and duplicate lines.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'sort-lines',
    name: 'Sort Lines',
    description: 'Sort lines of text and remove duplicates.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'text-compare',
    name: 'Text Compare',
    description: 'Show the differences between two texts.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'rephraser',
    name: 'Rephraser',
    description: 'Say a sentence in other words, with versions to choose from.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'grammar-helper',
    name: 'Grammar Helper',
    description: 'Explain how a sentence is built and point out mistakes.',
    groupId: 'text-writing',
    status: 'coming-soon',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Work out sums, with the steps shown.',
    groupId: 'numbers-converters',
    status: 'coming-soon',
  },
  {
    id: 'number-to-words',
    name: 'Number to Words',
    description: 'Write a number in words, and back.',
    groupId: 'numbers-converters',
    status: 'coming-soon',
  },
  {
    id: 'percentage-helper',
    name: 'Percentage Helper',
    description: 'Work out percentages, changes and shares.',
    groupId: 'numbers-converters',
    status: 'coming-soon',
  },
  {
    id: 'timer',
    name: 'Timer',
    description: 'Count down from a time you choose.',
    groupId: 'time-counters',
    status: 'coming-soon',
  },
  {
    id: 'stopwatch',
    name: 'Stopwatch',
    description: 'Time something, with laps.',
    groupId: 'time-counters',
    status: 'coming-soon',
  },
  {
    id: 'date-calculator',
    name: 'Date Calculator',
    description: 'Add or subtract days, or find the days between two dates.',
    groupId: 'time-counters',
    status: 'coming-soon',
  },
  {
    id: 'tally-counter',
    name: 'Tally Counter',
    description: 'Keep a running total with one tap.',
    groupId: 'time-counters',
    status: 'coming-soon',
  },
  {
    id: 'qr-maker',
    name: 'QR Code Maker',
    description: 'Turn text or a link into a QR code.',
    groupId: 'create-encode',
    status: 'coming-soon',
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Make strong passwords of the length you choose.',
    groupId: 'create-encode',
    status: 'coming-soon',
  },
  {
    id: 'random-picker',
    name: 'Random Picker',
    description: 'Pick random numbers, names or items from a list.',
    groupId: 'create-encode',
    status: 'coming-soon',
  },
  {
    id: 'encoder-decoder',
    name: 'Encoder and Decoder',
    description: 'Convert text to and from Base64, URL and hexadecimal.',
    groupId: 'create-encode',
    status: 'coming-soon',
  },
  {
    id: 'hash-tool',
    name: 'Hash and Checksum',
    description: 'Work out the checksum of a text or a file.',
    groupId: 'create-encode',
    status: 'coming-soon',
  },
  {
    id: 'dictionary',
    name: 'Dictionary',
    description: 'Look up words, with history, bookmarks, notes and a word of the day.',
    groupId: 'reading-knowledge',
    status: 'available',
    opens: 'dictionary',
  },
  {
    id: 'my-dictionary',
    name: 'My Dictionary',
    description: 'Import word lists with meanings from a file and keep them as your own data.',
    groupId: 'reading-knowledge',
    status: 'coming-soon',
  },
  {
    id: 'document-reader',
    name: 'Document Reader',
    description: 'Open long text files and search inside them.',
    groupId: 'reading-knowledge',
    status: 'coming-soon',
  },
  {
    id: 'translator',
    name: 'Translator',
    description: 'Translate between languages, one language at a time as they are added.',
    groupId: 'reading-knowledge',
    status: 'coming-soon',
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    description: 'Shorten a long text and keep what matters.',
    groupId: 'reading-knowledge',
    status: 'coming-soon',
  },
  {
    id: 'json-viewer',
    name: 'JSON and Data Viewer',
    description: 'Open JSON and tables and look through them.',
    groupId: 'web-data',
    status: 'coming-soon',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web from the chat.',
    groupId: 'web-data',
    status: 'coming-soon',
  },
  {
    id: 'axon-code',
    name: 'AXON Code',
    description: 'Write code, test it safely and report what passed.',
    groupId: 'code',
    status: 'coming-soon',
  },
  {
    id: 'code-formatter',
    name: 'Code Formatter',
    description: 'Tidy code so it is easy to read.',
    groupId: 'code',
    status: 'coming-soon',
  },
  {
    id: 'pattern-tester',
    name: 'Pattern Tester',
    description: 'Try a text pattern (regular expression) and see what it matches.',
    groupId: 'code',
    status: 'coming-soon',
  },
  {
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert between currencies using rates you can see.',
    groupId: 'finance',
    status: 'coming-soon',
  },
  {
    id: 'loan-calculator',
    name: 'Loan Calculator',
    description: 'Work out repayments and the total cost.',
    groupId: 'finance',
    status: 'coming-soon',
  },
  {
    id: 'split-bill',
    name: 'Split and Tip',
    description: 'Share a bill between people, with a tip.',
    groupId: 'finance',
    status: 'coming-soon',
  },
  {
    id: 'market-scope',
    name: 'Market Scope',
    description: 'Study markets (built separately, joined to AXON later).',
    groupId: 'finance',
    status: 'coming-soon',
  },
  {
    id: 'device-profile',
    name: 'Device Profile',
    description: 'Show what this phone can carry: memory, storage and Android version.',
    groupId: 'device-system',
    status: 'coming-soon',
  },
  {
    id: 'backup-restore',
    name: 'Backup and Restore',
    description: 'Save your AXON data, or bring it back.',
    groupId: 'device-system',
    status: 'coming-soon',
  },
];

export interface GroupView {
  group: ToolGroup;
  tools: CatalogTool[];
  /** False when no tool in the group is available yet: the screen shows "Coming soon". */
  hasAvailable: boolean;
}

/** True when the query is found in the tool's name or description (case-insensitive). */
export function toolMatches(tool: CatalogTool, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q);
}

/**
 * The groups to draw, in order, for a filter query.
 * Empty query: all groups, including empty ones.
 * With a query: a group stays when one of its tools matches (only matching tools are shown)
 * or when its own name matches (all of its tools are shown).
 */
export function buildGroupViews(
  query: string,
  groups: readonly ToolGroup[] = TOOL_GROUPS,
  tools: readonly CatalogTool[] = CATALOG_TOOLS
): GroupView[] {
  const q = query.trim().toLowerCase();
  const views: GroupView[] = [];
  for (const group of groups) {
    const inGroup = tools.filter((t) => t.groupId === group.id);
    let shown: CatalogTool[];
    if (q === '') {
      shown = inGroup;
    } else if (group.name.toLowerCase().includes(q)) {
      shown = inGroup;
    } else {
      shown = inGroup.filter((t) => toolMatches(t, q));
      if (shown.length === 0) continue;
    }
    views.push({
      group,
      tools: shown,
      hasAvailable: inGroup.some((t) => t.status === 'available'),
    });
  }
  return views;
}

export interface HomeRow {
  group: ToolGroup;
  /** Names of every tool in the group, available ones first. */
  toolNames: string[];
  /** How many tools the group holds. */
  count: number;
}

export interface ToolsHome {
  /** One row per group that has at least one available tool. */
  rows: HomeRow[];
  /** Names of the groups with nothing available yet, shown once in a quiet line. */
  comingGroups: string[];
}

function availableFirst(list: CatalogTool[]): CatalogTool[] {
  return [
    ...list.filter((t) => t.status === 'available'),
    ...list.filter((t) => t.status !== 'available'),
  ];
}

/** The tools of one group, available ones first, otherwise in catalog order. */
/** The tools in one Media choice (Image, Video or Audio), in catalog order. */
export function toolsInSubgroup(
  subgroup: MediaSubgroupId,
  tools: readonly CatalogTool[] = CATALOG_TOOLS
): CatalogTool[] {
  return tools.filter((t) => t.groupId === 'media' && t.subgroup === subgroup);
}

export function toolsInGroup(
  groupId: ToolGroupId,
  tools: readonly CatalogTool[] = CATALOG_TOOLS
): CatalogTool[] {
  return availableFirst(tools.filter((t) => t.groupId === groupId));
}

/** What the Tools home shows at a glance: group rows, then one line naming the rest. */
export function buildHome(
  groups: readonly ToolGroup[] = TOOL_GROUPS,
  tools: readonly CatalogTool[] = CATALOG_TOOLS
): ToolsHome {
  const rows: HomeRow[] = [];
  const comingGroups: string[] = [];
  for (const group of groups) {
    const inGroup = toolsInGroup(group.id, tools);
    if (inGroup.some((t) => t.status === 'available')) {
      rows.push({ group, toolNames: inGroup.map((t) => t.name), count: inGroup.length });
    } else {
      comingGroups.push(group.name);
    }
  }
  return { rows, comingGroups };
}

/**
 * A flat list of tools for a filter query: a tool matches by its name or description,
 * or because its group's name matches. An empty query gives an empty list
 * (the screen shows the home instead). Available tools come first.
 */
export function searchTools(
  query: string,
  groups: readonly ToolGroup[] = TOOL_GROUPS,
  tools: readonly CatalogTool[] = CATALOG_TOOLS
): CatalogTool[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const matchingGroups = new Set(
    groups.filter((g) => g.name.toLowerCase().includes(q)).map((g) => g.id)
  );
  return availableFirst(
    tools.filter((t) => toolMatches(t, q) || matchingGroups.has(t.groupId))
  );
}
