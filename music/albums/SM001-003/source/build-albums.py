"""Render and master the 24 scores. Run with SMALL_MACHINES_ENGINE set.
Two independent tracks at a time; each track is only mastered after its render.
"""
from pathlib import Path
import concurrent.futures,json,os,subprocess,sys,shutil
ROOT=Path(__file__).resolve().parent.parent
def build(path):
    name=path.stem
    for args in [['node',str(ROOT/'source/render.mjs'),name],['python3',str(ROOT/'source/master.py'),name]]:
        proc=subprocess.run(args,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if proc.returncode: raise RuntimeError(name+' '+proc.stderr[-5000:])
        print(proc.stdout.strip(),flush=True)
    shutil.copyfile(ROOT/'work'/f'{name}-render.json',ROOT/'verification'/f'{name}-render.json')
    for suffix in ['-raw.wav','-space.wav','-complete.mp3']:
        (ROOT/'work'/f'{name}{suffix}').unlink(missing_ok=True)
    return name
paths=sorted((ROOT/'scores').glob('*.json'))
if len(sys.argv)>1: paths=[p for p in paths if p.stem.startswith(sys.argv[1])]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    jobs={pool.submit(build,p):p for p in paths}
    for done in concurrent.futures.as_completed(jobs): print('COMPLETE '+done.result(),flush=True)
reports=[json.loads(p.read_text()) for p in sorted((ROOT/'verification').glob('*-master.json'))]
(ROOT/'audio-report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n')
print('All requested tracks complete.',flush=True)
