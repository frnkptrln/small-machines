#!/usr/bin/env python3
"""Serve the Small Machines studio locally using only Python's standard library."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    dist = Path(__file__).resolve().parent / 'dist'
    if not (dist / 'index.html').is_file():
        parser.error('dist/index.html is missing; extract or clone the complete repository')
    mimetypes.add_type('text/javascript', '.mjs')
    mimetypes.add_type('application/json', '.json')
    with ThreadingHTTPServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(dist))) as server:
        print(f'Small Machines: http://127.0.0.1:{args.port}/', flush=True)
        print('Local computer only. Press Ctrl+C to stop.', flush=True)
        if not (dist / 'audio' / 'licht-im-hinterhof.m4a').is_file():
            print('Optional listening recordings are absent. The instruments still work; see the archive documentation.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
