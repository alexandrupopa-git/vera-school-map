#!/usr/bin/env python3
"""Stamp a version on every local script/style URL in index.html so browsers and CDNs fetch fresh copies after a deploy.
Run after any change to the app files: python3 tools/stamp.py (build_exports.py calls it)."""
import re, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, 'index.html'); t = open(p, encoding='utf-8').read()
v = datetime.datetime.utcnow().strftime('%Y%m%d%H%M')
t = re.sub(r'(src|href)="((?!https?://)[^"?]+\.(?:js|css))(\?v=[^"]*)?"', lambda m: f'{m.group(1)}="{m.group(2)}?v={v}"', t)
open(p, 'w', encoding='utf-8').write(t)
sw = os.path.join(ROOT, 'sw.js'); s = open(sw, encoding='utf-8').read()
s = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'vsm-{v}';", s); open(sw, 'w', encoding='utf-8').write(s)
print('stamped', v)
