"""Disposable validation only: apply pinned R02 and isolated W03 date delta."""
import base64
import gzip
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap

BASE = '7f170d211d7ef95556df343a4dd462b2b6e2b0db'
W03 = {
    'src/lib/recovery-flow.ts', 'src/lib/post-login.ts', 'src/lib/supabase.ts',
    'src/components/glam/password-recovery.tsx', 'src/routes/auth.confirm.tsx',
    'src/routes/reset-password.tsx', 'src/routes/login.tsx',
    'tests/recovery-w03.test.mjs', 'tests/e2e/recovery-w03.mjs',
}
changed = set(subprocess.check_output([
    'git', 'diff', '--name-only', BASE, '--', 'src', 'tests', 'scripts', 'supabase',
    'package.json', 'package-lock.json'], text=True).splitlines())
assert changed == W03, 'STOP: unreviewed source drift: ' + repr(changed ^ W03)
encoded = ''.join(Path(f'validation/repair.part{i}').read_text().strip() for i in (1, 2, 3))
patch = gzip.decompress(base64.b64decode(encoded, validate=True))
assert len(patch) == 50923
assert hashlib.sha256(patch).hexdigest() == '45f12b58b990589bda5433bbbe8c06eef4884dfb4d49c299b46ef54cae0e1851'
patch_path = Path(tempfile.gettempdir()) / 'glam-r02-under-w03.patch'
patch_path.write_bytes(patch)
subprocess.run(['git', 'apply', '--check', str(patch_path)], check=True)
subprocess.run(['git', 'apply', str(patch_path)], check=True)
recipe = Path('validation/r02-workflow.yml').read_text()

def block(name):
    marker = '      - name: ' + name + '\n'
    assert recipe.count(marker) == 1
    segment = recipe.split(marker, 1)[1].split('\n      - name:', 1)[0]
    return textwrap.dedent(segment.split('        run: |\n', 1)[1])

subprocess.run(['bash', '-euo', 'pipefail', '-c', block('Apply five strict TypeScript fixes and format-neutral guards')], check=True)
path = Path('src/routes/salon.$salonId.book.tsx')
source = path.read_bytes()
blob = hashlib.sha1(f'blob {len(source)}\0'.encode() + source).hexdigest()
assert blob == 'ed1a67589651b346bc82ad4589cc4706bd99b5cd'
text = source.decode()
old = 'import { bookingDate, bookingTime } from "@/lib/booking-time";'
assert text.count(old) == 1
assert text.count('a.starts_at.slice(0, 10)') == 2
text = text.replace(old, 'import { bookingDate, bookingDateKey, bookingTime } from "@/lib/booking-time";')
text = text.replace('a.starts_at.slice(0, 10)', 'bookingDateKey(a.starts_at)')
path.write_text(text, encoding='utf-8')
network = block('Enforce and prove loopback-only Node application traffic')
(Path(os.environ['RUNNER_TEMP']) / 'glam-network-setup.sh').write_text(network)
browser = block('Real browser nested routes with synthetic local HTTP only')
js = browser.split("node --input-type=module - <<'JS'\n", 1)[1]
assert js.rstrip().endswith('\nJS')
Path('tests/e2e/r02-validation-browser.mjs').write_text(js.rstrip()[:-3] + '\n')
print('PASS: exact R02 source plus nine W03 inputs and three date replacements; no hosted environment touched')
