/** Deterministic, conservative code-region detection for text interpretation. */
export interface CodeRegion { start: number; end: number; kind: 'fenced' | 'inline' | 'indented' | 'dense'; text: string; }
export interface CodeRegionResult { regions: CodeRegion[]; unsure: boolean; }

const CODE_LINE = /(?:^\s*(?:(?:const|let|var|function|return|import|export|class|interface|type|async|await|if|else|for|while|new|public|private|def|print|SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|FROM|WHERE)\b|rm\s|npm\s|git\s|curl\s|echo\s)|=>|===|!==|\+=|\*=|\$\{|\bconsole\.|\bprint\s*\(|\b(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*\b(?:FROM|INTO|SET)\b|<\/?[A-Za-z][^>]*>|^\s*\{\s*"[\w-]+"\s*:|^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*;|^\s*(?:const|let|var)\s+\w+\s*=\s*\/.*\/\s*;?)/i;
const LIST_LINE = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
const PUA = /[\uE000-\uF8FF]/u;
function push(regions: CodeRegion[], text: string, start: number, end: number, kind: CodeRegion['kind']): void {
  if (end > start) regions.push({ start, end, kind, text: text.slice(start, end) });
}
function lineRecords(text: string): Array<{start:number; contentEnd:number; end:number; body:string}> {
  const out: Array<{start:number;contentEnd:number;end:number;body:string}> = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf('\n', start);
    const end = nl < 0 ? text.length : nl + 1;
    let contentEnd = nl < 0 ? text.length : nl;
    if (contentEnd > start && text[contentEnd - 1] === '\r') contentEnd--;
    out.push({start, contentEnd, end, body:text.slice(start,contentEnd)});
    start = end;
  }
  if (!text.length) return out;
  return out;
}

export function detectCodeRegions(text: string): CodeRegionResult {
  const regions: CodeRegion[] = [];
  let unsure = false;
  const occupied = new Uint8Array(text.length);
  const add = (start:number,end:number,kind:CodeRegion['kind']) => {
    if (start < 0 || end <= start) return;
    // Preserve source order and don't let a weaker detector overlap a stronger region.
    for (let i=start;i<end;i++) if (occupied[i]) return;
    push(regions,text,start,end,kind); occupied.fill(1,start,end);
  };
  const lines = lineRecords(text);

  // Fences may begin after a prompt prefix. A closed region ends at the closing fence,
  // excluding the newline after it; an unclosed fence runs through EOF.
  let fenceStart = -1, fenceChar = '', fenceWidth = 0;
  for (const line of lines) {
    const run = /(`{3,}|~{3,})/.exec(line.body);
    if (fenceStart < 0) {
      if (run && !line.body.slice(0,run.index).includes('`') && !line.body.slice(0,run.index).includes('~')) {
        fenceStart = line.start + run.index; fenceChar = run[1][0]; fenceWidth = run[1].length;
      }
    } else {
      const closeRe = new RegExp('^\\s*' + (fenceChar === '`' ? '`' : '~') + '{' + fenceWidth + ',}\\s*$');
      if (closeRe.test(line.body)) {
        add(fenceStart,line.contentEnd,'fenced'); fenceStart = -1; fenceChar = ''; fenceWidth = 0;
      }
    }
  }
  if (fenceStart >= 0) add(fenceStart,text.length,'fenced');

  // Inline single-backtick code spans are same-line only; fenced ranges already own theirs.
  for (const line of lines) {
    let i=line.start;
    while (i<line.contentEnd) {
      if (text[i] !== '`' || occupied[i] || text[i+1] === '`') { i++; continue; }
      let j=i+1;
      while (j<line.contentEnd && (text[j] !== '`' || occupied[j])) j++;
      if (j<line.contentEnd) { add(i,j+1,'inline'); i=j+1; }
      else i++;
    }
  }

  // Indented blocks: at least two adjacent indented non-list lines and a code signal.
  for (let i=0;i<lines.length;) {
    const l=lines[i];
    const indented = /^(?: {4,}|\t)\S/.test(l.body) && !LIST_LINE.test(l.body) && !occupied[l.start];
    if (!indented) { i++; continue; }
    let j=i+1;
    while (j<lines.length && /^(?: {4,}|\t)\S/.test(lines[j].body) && !LIST_LINE.test(lines[j].body) && !occupied[lines[j].start]) j++;
    if (j-i>=2) {
      const block=lines.slice(i,j);
      if (block.some(x=>CODE_LINE.test(x.body))) add(block[0].start,block[block.length-1].contentEnd,'indented');
      else unsure=true;
    } else if (!CODE_LINE.test(l.body)) {
      unsure=true;
    }
    i=Math.max(i+1,j);
  }

  // A code payload can follow a natural-language instruction and colon on the same line.
  for (const line of lines) {
    if (occupied[line.start]) continue;
    const colon = /:\s+(.+)$/.exec(line.body);
    if (colon) {
      const tail = colon[1].trimEnd();
      const start = line.start + colon.index + colon[0].length - colon[1].length;
      const strongTail = /^(?:for|while)\s*\(|\{\s*\"|<\/?[A-Za-z][^>]*>|SELECT\b[\s\S]*\bFROM\b|(?:rm\s+-\w+|npm\s+run|git\s+\w+|curl\s+)|(?:const|let|var)\s+\w+\s*=|print\s*\(|[.#]?[\w-]+\s*\{[^}]*:[^}]*;|(?:\w+\s*=.*(?:\+|\*|=>|\[[^]]+\]))/i.test(tail);
      if (strongTail) add(start, start + tail.length, 'dense');
    }
  }

  // Strong code lines can appear inside prose (e.g. a while loop in a question).
  // Group adjacent nonblank code lines; don't consume ordinary list lines.
  for (let i=0;i<lines.length;) {
    const l=lines[i];
    if (occupied[l.start] || !CODE_LINE.test(l.body) || LIST_LINE.test(l.body)) { i++; continue; }
    let j=i+1;
    while (j<lines.length && !occupied[lines[j].start] && CODE_LINE.test(lines[j].body) && !LIST_LINE.test(lines[j].body)) j++;
    const start=l.start, end=lines[j-1].contentEnd;
    // A single strong code-looking line is accepted only with unmistakable syntax.
    const strong = /(?:=>|===|!==|\+=|\*=|\b(?:for|while)\s*\(|\b(?:const|let|var)\s+\w+\s*=|\bprint\s*\(|<\/?[A-Za-z][^>]*>|^\s*\{\s*"|\bSELECT\b[\s\S]*\bFROM\b|^\s*(?:rm\s+-|npm\s+run\b|git\s+|curl\s+)|^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*;|\/\^[^\n]+\/)/i.test(text.slice(start,end).trim());
    if (strong) add(start,end,'dense');
    i=Math.max(i+1,j);
  }

  // Entire one-line expressions that are recognisably code even when not keyword-led.
  if (regions.length===0 && text.trim() && !text.includes('\n')) {
    const t=text.trim();
    const strongWhole = /^(?:\{\s*"[\s\S]*\}\s*|<\/?[A-Za-z][\s\S]*>|SELECT\b[\s\S]*\bFROM\b[\s\S]*|(?:rm\s+-\w+|npm\s+run|git\s+\w+|curl\s+)[\s\S]*|(?:const|let|var)\s+\w+\s*=\s*\/.*\/;?|(?:for|while)\s*\([\s\S]*\)\s*\{[\s\S]*\}|print\s*\([\s\S]*\)|[.#]?[\w-]+\s*\{[^}]*:[^}]*;[^}]*\})$/i.test(t);
    if (strongWhole) add(0,text.length,'dense');
  }

  // Unclosed inline tick is ambiguous only when no stronger region was identified.
  if (!regions.length && /`/.test(text) && !/`[^`\n]+`/.test(text) && !/```/.test(text)) unsure=true;
  regions.sort((a,b)=>a.start-b.start || a.end-b.end);
  const clean: CodeRegion[]=[];
  for (const r of regions) { const p=clean[clean.length-1]; if (!p || r.start>=p.end) clean.push(r); }
  return {regions:clean,unsure};
}
