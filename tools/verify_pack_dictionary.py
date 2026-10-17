#!/usr/bin/env python3
"""G3 candidate proof: every original shard byte is reproduced exactly."""
import hashlib, json, zipfile, sys
from pathlib import Path
sha = lambda b: hashlib.sha256(b).hexdigest()
def verify(src, packed):
    orig = json.loads((src/'manifest.json').read_text())
    manifest = json.loads((packed/'manifest.json').read_text())
    index_bytes = (packed/'packs/index.json').read_bytes()
    index = json.loads(index_bytes)
    assert manifest['version'] == 2 and index['version'] == 1
    assert len(index['files']) == len(manifest['logicalFiles'])
    assert set(orig['files']) == set(manifest['logicalFiles']) | {'forms.json','index.json'}
    for p, info in manifest['files'].items():
        data = (packed/p).read_bytes()
        assert len(data) == info['bytes'] and sha(data) == info['sha256'], p
    for p in ['ATTRIBUTION.txt', 'licenses/LICENSE.md', 'licenses/WNDB_License.txt']:
        assert (src/p).read_bytes() == (packed/p).read_bytes(), p
    checked = 0
    for name, info in index['packs'].items():
        data = (packed/'packs'/name).read_bytes()
        assert len(data) == info['bytes'] and sha(data) == info['sha256'], name
        with zipfile.ZipFile(packed/'packs'/name) as z:
            members = set(z.namelist())
            expected = {p for p,n in index['files'].items() if n == name}
            assert members == expected, name
            for p in expected:
                uncompressed = z.read(p)
                assert uncompressed == (src/p).read_bytes(), p
                assert sha(uncompressed) == orig['files'][p]['sha256'], p
                checked += 1
    assert checked == len(manifest['logicalFiles'])
    for field in ('entries', 'senses', 'headwords'):
        assert manifest[field] == orig[field], field
    print(f'G3 PACK VERIFY OK: {checked} shard bytes identical; all 3 legal files identical; 0 missing or different')
if __name__ == '__main__': verify(Path(sys.argv[1]), Path(sys.argv[2]))
