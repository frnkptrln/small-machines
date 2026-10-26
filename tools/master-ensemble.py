"""Master the rendered ensemble with a fixed gain; preserve scene dynamics.

Usage: python3 tools/master-ensemble.py /absolute/render-directory [analysis.json]
Requires ffmpeg/ffprobe. An optional analysis must be the loudnorm JSON for
the same input with highpass=24 Hz and the 902–904 s fade shown below.
"""
import array
import json
import math
import pathlib
import re
import subprocess
import sys
import wave

folder = pathlib.Path(sys.argv[1]).resolve()
raw = folder / 'licht-im-hinterhof-raw.wav'
base = 'highpass=f=24,afade=t=out:st=902:d=2'

def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True)

def ffmpeg(*args):
    return run(['ffmpeg', '-hide_banner', '-nostats', '-y', *map(str, args)])

if len(sys.argv) > 2:
    analysis = json.loads(pathlib.Path(sys.argv[2]).read_text())
else:
    log = ffmpeg('-i', raw, '-af', base + ',loudnorm=I=-17:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-').stderr
    analysis = json.loads(re.findall(r'\{[^{}]+\}', log)[-1])
gain = min(-17 - float(analysis['input_i']), -2 - float(analysis['input_tp']))
wav = folder / 'Licht-im-Hinterhof.wav'
mp3 = folder / 'Licht-im-Hinterhof.mp3'
m4a = folder / 'licht-im-hinterhof.m4a'
metadata = ['-metadata', 'title=Licht im Hinterhof', '-metadata', 'artist=Small Machines', '-metadata', 'album=Small Machines Sessions 001', '-metadata', 'date=2026', '-metadata', 'genre=Electronic']
ffmpeg('-i', raw, '-af', base + f',volume={gain:.6f}dB', '-ar', 44100, '-c:a', 'pcm_s16le', *metadata, wav)
ffmpeg('-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', *metadata, mp3)
ffmpeg('-i', wav, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', *metadata, m4a)
peak = clipped = count = 0
energy = 0
first = last = None
with wave.open(str(wav), 'rb') as f:
    assert f.getnchannels() == 2 and f.getsampwidth() == 2 and f.getframerate() == 44100
    assert f.getnframes() == 904 * 44100
    while block := f.readframes(65536):
        samples = array.array('h', block)
        if sys.byteorder != 'little':
            samples.byteswap()
        if first is None:
            first = list(samples[:2])
        last = list(samples[-2:])
        peak = max(peak, max(abs(s) for s in samples))
        clipped += sum(abs(s) >= 32767 for s in samples)
        energy += sum(s * s for s in samples)
        count += len(samples)
assert not clipped and first == [0, 0] and last == [0, 0]
formats = []
for path in [wav, mp3, m4a]:
    info = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', str(path)]).stdout)
    assert abs(float(info['format']['duration']) - 904) < .1
    formats.append({'file': path.name, **info})
log = ffmpeg('-i', mp3, '-af', 'ebur128=peak=true', '-f', 'null', '-').stderr
summary = log[log.rfind('Summary:'):]
true_peak = float(re.findall(r'Peak:\s*([-\d.]+) dBFS', summary)[-1])
assert true_peak < -1, summary
report = {'seconds': 904, 'sourceAnalysis': analysis, 'fixedGainDb': gain, 'processing': '24 Hz highpass, fixed gain, final 2 s fade; no dynamic loudness compression', 'pcmSamplePeakDbfs': 20 * math.log10(peak / 32768), 'pcmRmsDbfs': 20 * math.log10(math.sqrt(energy / count) / 32768), 'clippedSamples': clipped, 'firstStereoFrame': first, 'lastStereoFrame': last, 'mp3LoudnessAndTruePeak': summary, 'formats': formats}
(folder / 'master-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
