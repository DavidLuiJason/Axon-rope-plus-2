#!/usr/bin/env python3
"""G3 candidate: lossless, independently compressed shard blocks in ~60 ZIP packs.

Each shard remains an independent ZIP member. The app will download only the
pack containing a requested shard, not the full dictionary. Does NOT change the
source dictionary: write to an explicit separate output directory for evaluation.
"""
import argparse, hashlib, json, shutil, zipfile
from pathlib import Path

def sha(b): return hashlib.sha256(b).hexdigest()
def pack(src: Path, out: Path, max_raw: int = 1_200_000):
    if out.exists() and any(out.iterdir()): raise ValueError('Output directory must be empty')
    original = json.loads((src/'manifest.json').read_text())
    files = original['files']
    for p in ['ATTRIBUTION.txt', 'licenses/LICENSE.md', 'licenses/WNDB_License.txt', 'forms.json', 'index.json']:
        if not (src/p).is_file(): raise ValueError('Required dictionary file missing: ' + p)
    if 'Princeton' not in (src/'ATTRIBUTION.txt').read_text(): raise ValueError('Required attribution is invalid')
    out.mkdir(parents=True, exist_ok=True)
    (out/'packs').mkdir()
    logical = {}
    physical = {}
    lookup = {}
    pack_info = {}
    raw_total = 0
    shards = sorted(p for p in files if p.startswith(('core/', 'rel/')))
    groups, current, size = [], [], 0
    for path in shards:
        info = files[path]
        if current and size + info['bytes'] > max_raw:
            groups.append(current); current, size = [], 0
        current.append(path); size += info['bytes']
    if current: groups.append(current)
    for number, group in enumerate(groups):
        name = f'pack-{number:03d}.zip'
        with zipfile.ZipFile(out/'packs'/name, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for p in group:
                data = (src/p).read_bytes()
                if len(data) != files[p]['bytes'] or sha(data) != files[p]['sha256']:
                    raise ValueError('Source shard failed hash check: ' + p)
                z.writestr(p, data)
                logical[p] = files[p]
                lookup[p] = name
                raw_total += len(data)
        data = (out/'packs'/name).read_bytes()
        pack_info[name] = {'bytes': len(data), 'sha256': sha(data)}
        physical[f'packs/{name}'] = pack_info[name]
    for p in ['forms.json', 'index.json']:
        data = (src/p).read_bytes()
        if sha(data) != files[p]['sha256'] or len(data) != files[p]['bytes']: raise ValueError('Metadata hash failed: ' + p)
        target = out/p; target.write_bytes(data)
        physical[p] = files[p]
    for p in ['ATTRIBUTION.txt', 'licenses/LICENSE.md', 'licenses/WNDB_License.txt']:
        target = out/p; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src/p, target)
    pack_index = {'version': 1, 'packs': pack_info, 'files': lookup}
    index_bytes = json.dumps(pack_index, sort_keys=True, separators=(',', ':')).encode()
    (out/'packs/index.json').write_bytes(index_bytes)
    physical['packs/index.json'] = {'bytes': len(index_bytes), 'sha256': sha(index_bytes)}
    manifest = {k:v for k,v in original.items() if k not in ('files', 'version')}
    manifest.update({'version': 2, 'form': 'packs', 'files': physical, 'logicalFiles': logical})
    (out/'manifest.json').write_text(json.dumps(manifest, sort_keys=True, separators=(',', ':')))
    compressed = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
    print(f'G3 PACK CANDIDATE: {len(shards)} independently compressed shards in {len(groups)} packs; {sum(1 for p in out.rglob("*") if p.is_file())} physical files; {compressed} bytes; {raw_total} original shard bytes')
    return len(groups)

if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('source'); a.add_argument('output'); a.add_argument('--max-raw', type=int, default=1_200_000)
    args = a.parse_args(); pack(Path(args.source), Path(args.output), args.max_raw)
