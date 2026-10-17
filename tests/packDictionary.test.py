"""G3 candidate proof on the real dictionary; does not change production data."""
from pathlib import Path
import subprocess, sys, tempfile
root = Path(__file__).resolve().parent.parent
src = root/'public/dictionary/en'
with tempfile.TemporaryDirectory(prefix='axon-g3-pack-') as tmp:
    subprocess.run([sys.executable, str(root/'tools/pack_dictionary.py'), str(src), tmp], check=True)
    subprocess.run([sys.executable, str(root/'tools/verify_pack_dictionary.py'), str(src), tmp], check=True)
