#!/usr/bin/env python3
"""Validate local archive assets and optionally upload a new draft GitHub release."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REPO = 'frnkptrln/small-machines'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('assets_directory', type=Path)
    parser.add_argument('--check-only', action='store_true', help='verify bytes without network access')
    parser.add_argument('--tag', help='new release tag, required for upload')
    parser.add_argument('--target', help='existing source commit or branch, required for upload')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'archive/manifest.json').read_text())
    files = []
    for asset in manifest['assets']:
        name = asset['filename']
        if Path(name).name != name:
            parser.error('Asset filename must not contain a directory')
        path = args.assets_directory.resolve() / name
        if not path.is_file() or path.stat().st_size != asset['bytes']:
            parser.error('Missing or incorrect asset size: ' + name)
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != asset['sha256']:
            parser.error('Incorrect asset SHA256: ' + name)
        files.append(str(path))
        print('Verified:', name, flush=True)
    if args.check_only:
        return
    if not args.tag or not args.target or args.tag.startswith('-') or args.target.startswith('-'):
        parser.error('--tag and --target are required for upload')
    gh = shutil.which('gh')
    if not gh:
        parser.error('Install the official GitHub CLI and authenticate before uploading.')
    subprocess.run([gh, 'auth', 'status', '--hostname', 'github.com'], check=True)
    # An existing tag/release is not overwritten. gh release create will fail safely.
    notes = ('Small Machines — studio and recording archive.\n\n'
             'Two music archives, precomputed video cues, and three listening-room recordings. '
             'Extract the two music ZIPs into the same folder. Source, production steps and '
             'checksums are in the accompanying repository.\n\n'
             'This is a draft for review. Full-album lossless masters and exported music videos '
             'were not supplied.\n')
    with tempfile.TemporaryDirectory(prefix='small-machines-release-') as directory:
        body = Path(directory) / 'notes.md'
        body.write_text(notes)
        subprocess.run([gh, 'release', 'create', args.tag, *files, '--repo', REPO,
                        '--target', args.target, '--draft', '--title', 'Small Machines — Archive 01',
                        '--notes-file', str(body)], check=True)
    print('Draft uploaded. Review the release assets before publishing and update archive/manifest.json afterwards.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
