#!/usr/bin/env bash
# AXON G6: safely unpack one uploaded root-level ZIP, preserving existing files.
# Workflow files cannot be changed by GITHUB_TOKEN; any changed workflow aborts.
set -euo pipefail
if [[ $# -ne 1 || ! -f "$1" || "$1" == */* || "$1" != *.zip ]]; then
  echo 'Usage: tools/auto-unpack.sh ROOT_UPLOAD.zip' >&2; exit 2
fi
ZIP="$1"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
python3 - "$ZIP" "$TMP" <<'PY'
import os, sys, stat, zipfile, shutil
from pathlib import Path
archive, dest = sys.argv[1:]
with zipfile.ZipFile(archive) as z:
    members = [i for i in z.infolist() if not i.is_dir()]
    if not members: raise SystemExit('UNPACK REFUSED: empty zip')
    if len(members) > 25000 or sum(i.file_size for i in members) > 1024*1024*1024:
        raise SystemExit('UNPACK REFUSED: archive exceeds safe capacity budget')
    for info in members:
        name = info.filename
        parts = Path(name).parts
        if name.startswith('/') or '\\' in name or '..' in parts or '.' in parts or not name.strip():
            raise SystemExit(f'UNPACK REFUSED: unsafe path {name}')
        if stat.S_ISLNK(info.external_attr >> 16):
            raise SystemExit(f'UNPACK REFUSED: symlink {name}')
    names = [m.filename for m in members]
    wrappers = {n.split('/')[0] for n in names if '/' in n}
    if len(wrappers) == 1 and all('/' in n for n in names) and any(n.endswith('/package.json') for n in names):
        prefix = next(iter(wrappers)) + '/'
    else: prefix = ''
    normalized = [(m, m.filename[len(prefix):]) for m in members]
    if len({n for _,n in normalized}) != len(normalized): raise SystemExit('UNPACK REFUSED: duplicate names')
    if any(not n or n.startswith('/') or '..' in Path(n).parts for _,n in normalized): raise SystemExit('UNPACK REFUSED: invalid normalized path')
    # Reject a likely partial project export before changing the repository.
    if len(normalized) >= 70 and any(n == 'package.json' for _,n in normalized) and not any(n.startswith('public/dictionary/') for _,n in normalized):
        raise SystemExit('UNPACK REFUSED: large project ZIP without dictionary (incomplete export)')
    for member, name in normalized:
        if name in ('tools/guard.mjs', 'tools/files.lock', 'tools/auto-unpack.sh'):
            original = Path(name)
            if not original.is_file() or original.read_bytes() != z.read(member):
                raise SystemExit(f'UNPACK REFUSED: protected foundation file differs: {name}. Apply intentionally using the manual workflow.')
            continue
        if name.startswith('.github/workflows/'):
            original = Path(name)
            if not original.is_file() or original.read_bytes() != z.read(member):
                raise SystemExit(f'UNPACK REFUSED: workflow differs: {name}. Update it manually on GitHub first.')
            continue
        if name.startswith('public/_axon-source/') or name in ('.env', '.env.local') or name.startswith('node_modules/'):
            raise SystemExit(f'UNPACK REFUSED: generated or secret file: {name}')
        target = Path(dest) / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(z.read(member))
print(f'UNPACK VERIFIED: {len(normalized)} entries; wrapper={prefix or "none"}')
PY
# The temporary tree has passed path and workflow checks; now apply it.
cp -a "$TMP"/. ./
node tools/guard.mjs --strict
rm -f -- "$ZIP"
echo "AUTO-UNPACK OK: $ZIP removed; guard passed"
