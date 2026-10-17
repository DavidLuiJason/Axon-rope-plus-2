"""Real-tree safety checks for AXON's automatic upload pipeline (local simulation)."""
from pathlib import Path
import os, shutil, subprocess, tempfile, zipfile
ROOT = Path(__file__).resolve().parent.parent
checks = 0
with tempfile.TemporaryDirectory(prefix='axon-unpack-test-') as temp:
    dest = Path(temp) / 'project'
    shutil.copytree(ROOT, dest, ignore=shutil.ignore_patterns('_axon-source', 'node_modules', 'dist', 'android', 'build', 'coverage', '.git'))
    def run(name, files):
        with zipfile.ZipFile(dest / name, 'w', zipfile.ZIP_DEFLATED) as z:
            for path, data in files.items(): z.writestr(path, data)
        return subprocess.run(['bash', 'tools/auto-unpack.sh', name], cwd=dest, capture_output=True, text=True)
    def assert_result(cond, msg):
        global checks
        checks += 1
        if not cond: raise AssertionError(msg)
    r = run('good.zip', {'docs/auto-unpack-test.txt': b'hello auto pipeline\n'})
    assert_result(r.returncode == 0 and (dest/'docs/auto-unpack-test.txt').read_text() == 'hello auto pipeline\n' and not (dest/'good.zip').exists(), f'valid one-file patch: {r.stderr} {r.stdout}')
    r = run('badpath.zip', {'../outside.txt': b'bad'})
    assert_result(r.returncode != 0 and not (dest.parent/'outside.txt').exists(), 'traversal rejected')
    r = run('badworkflow.zip', {'.github/workflows/android-debug.yml': b'name: hacked\n'})
    assert_result(r.returncode != 0 and (dest/'.github/workflows/android-debug.yml').read_bytes() == (ROOT/'.github/workflows/android-debug.yml').read_bytes(), 'workflow modification rejected')
    r = run('nodict.zip', {'package.json': b'{}', **{f'src/test-{i}.txt': b'X' for i in range(75)}})
    assert_result(r.returncode != 0, 'incomplete project export rejected')
    r = run('baddict.zip', {'public/dictionary/en/forms.json': b'{}'})
    assert_result(r.returncode != 0, 'corrupted dictionary refused by guard')
    print(f'AUTO-UNPACK TEST OK: {checks} scenarios (local simulation; not GitHub proof)')
