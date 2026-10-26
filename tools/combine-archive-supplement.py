#!/usr/bin/env python3
"""Combine the reviewed studio and video exports into the shared archive tree."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--studio-zip', type=Path, required=True)
    parser.add_argument('--video-zip', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    payload = {}
    for source, section in [(args.studio_zip, '06-Studio'), (args.video_zip, '07-Video-Uebergabe')]:
        with zipfile.ZipFile(source) as z:
            assert z.testzip() is None, f'Corrupt input: {source}'
            for item in z.infolist():
                if item.is_dir():
                    continue
                name = PurePosixPath(item.filename)
                assert not name.is_absolute() and '..' not in name.parts
                assert name.parts[:2] == ('Small-Machines-Archiv', section), item.filename
                assert all(not part.startswith('.') for part in name.parts), item.filename
                assert item.filename not in payload, f'Duplicate: {item.filename}'
                assert (item.external_attr >> 16) & 0o170000 != 0o120000, 'No symlinks'
                payload[item.filename] = z.read(item)
    manifest = {
        'format': 'small-machines-archive-supplement', 'version': 1,
        'date': '2026-10-24', 'source_commit': '4cf5a47e58eee238f1fde0e68c38a178092c683f',
        'instructions': 'Extract with the two music archive parts into the same parent folder.',
        'source_parts': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in (args.studio_zip, args.video_zip)],
        'files': [{'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(payload.items())],
    }
    payload['Small-Machines-Archiv/STUDIO-UND-PARTITUREN.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(payload.items()):
            item = zipfile.ZipInfo(name, date_time=(2026, 10, 24, 12, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o100644 << 16
            z.writestr(item, data, compresslevel=9)
    with zipfile.ZipFile(args.output) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(payload)
        for entry in manifest['files']:
            assert hashlib.sha256(z.read(entry['path'])).hexdigest() == entry['sha256']
    print(json.dumps({'output': str(args.output.resolve()), 'bytes': args.output.stat().st_size,
                      'files': len(payload), 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
