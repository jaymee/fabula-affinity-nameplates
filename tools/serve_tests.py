#!/usr/bin/env python3
"""Serve browser fixtures using icons from a separately installed Project FU."""
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
parser = argparse.ArgumentParser()
parser.add_argument('--projectfu', type=Path, required=True)
parser.add_argument('--port', type=int, default=8768)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(root), **kw)
    def translate_path(self, path):
        clean = urlsplit(path).path
        prefix = '/systems/projectfu/styles/static/affinities/icons/'
        if clean.startswith(prefix):
            name = clean[len(prefix):]
            if name in {key + '.png' for key in ['physical','air','bolt','dark','earth','fire','ice','light','poison']}:
                return str(args.projectfu / 'styles/static/affinities/icons' / name)
            return str(root / '__not_found__')
        return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
print(f'Browser harness: http://localhost:{args.port}/tests/browser.html', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
