/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FL12 / Rule 12: the chat brain import boundary is a ratchet.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

// Adding a file here is a deliberate decision: everything in the chat must go through the brain pipeline (FL12).
const ALLOWED_BRAIN_IMPORTERS = [
  'src/components/CreditsModal.tsx',
  'src/services/axonBrainInterface.ts',
] as const;

const SRC = resolve('src');
const BRAIN = resolve('src/brain');
const extensions = ['.ts', '.tsx'];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (extensions.includes(extname(entry.name))) out.push(full);
  }
  return out;
}

function resolvesIntoBrain(fromFile: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const target = resolve(dirname(fromFile), specifier);
  const rel = relative(BRAIN, target);
  const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  if (!inside) return false;
  const candidates = [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), join(target, 'index.tsx')];
  return candidates.some((candidate) => existsSync(candidate));
}

function brainImports(file: string): boolean {
  const source = readFileSync(file, 'utf8');
  const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) if (resolvesIntoBrain(file, match[1])) return true;
  return false;
}

function main(): void {
  const files = listSourceFiles(SRC).filter((file) => file !== BRAIN && !file.startsWith(`${BRAIN}/`));
  const found = files.filter(brainImports).map((file) => relative(process.cwd(), file).replace(/\\/g, '/')).sort();
  const allowed: string[] = [...ALLOWED_BRAIN_IMPORTERS].sort();
  for (const file of found) if (!allowed.includes(file)) throw new Error(`Unapproved file imports the brain: ${file}`);
  for (const file of allowed) if (!found.includes(file)) throw new Error(`Allowed brain importer no longer imports the brain: ${file}`);
  console.log(`B1 brain boundary passed: ${found.length} allowed importers (${found.join(', ')})`);
}

main();
