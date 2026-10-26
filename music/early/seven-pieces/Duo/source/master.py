"""Subtle stereo space and two-pass loudness mastering of the actual engine mix.
Requires Python + numpy/scipy and ffmpeg on PATH. No external audio assets.
"""
from pathlib import Path
import json,re,subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt,fftconvolve
ROOT=Path(__file__).resolve().parent.parent
AUDIO=ROOT/'audio'; AUDIO.mkdir(exist_ok=True)

def run(args):
    if args[0]=='ffmpeg' and '-nostdin' not in args: args.insert(1,'-nostdin')
    r=subprocess.run(args,capture_output=True,text=True)
    if r.returncode: raise RuntimeError(r.stderr[-3000:])
    return r

def room(rate,seconds,seed):
    rng=np.random.default_rng(seed); n=round(rate*seconds); t=np.arange(n)/rate
    ir=rng.normal(0,1,n)*np.exp(-6.9*t/seconds)
    ir=sosfilt(butter(2,3400,fs=rate,output='sos'),ir)
    ir[:round(.021*rate)]=0
    ir/=max(1e-8,np.linalg.norm(ir))
    for time,gain in [(0.029,.22),(.047,.18),(.071,.13),(.109,.08)]: ir[round(time*rate)]+=gain
    return ir.astype(np.float32)

reports=[]
for index,path in enumerate(sorted((ROOT/'scores').glob('*.json'))):
    score=json.loads(path.read_text()); name=score['id']; rate,raw=wavfile.read(ROOT/'work'/f'{name}-raw.wav')
    assert raw.ndim==2 and raw.shape[1]==2 and np.isfinite(raw).all()
    clean=sosfilt(butter(2,27,fs=rate,btype='highpass',output='sos'),raw,axis=0)
    clean=sosfilt(butter(2,13800,fs=rate,output='sos'),clean,axis=0)
    seconds=[1.7,1.1,2.7][index]; mix=score['mix']['reverb']; out=clean.copy()
    for ch in range(2):
        send=clean[:,ch]*.75+clean[:,1-ch]*.25
        wet=fftconvolve(send,room(rate,seconds,6832+index*10+ch))[:len(send)]
        out[:,ch]+=mix*wet
    # Finish the space with a smooth fade rather than truncating reverb tails.
    fade=round(rate*1.7);out[-fade:]*=np.linspace(1,0,fade)[:,None]
    processed=ROOT/'work'/f'{name}-space.wav';wavfile.write(processed,rate,out.astype(np.float32))
    target=[-16,-15.5,-18][index]
    first=run(['ffmpeg','-hide_banner','-nostats','-i',str(processed),'-af',f'loudnorm=I={target}:TP=-1.5:LRA=12:print_format=json','-f','null','-'])
    stats=json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}',first.stderr).group())
    filt=(f'loudnorm=I={target}:TP=-1.5:LRA=12:measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:'
          f'measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:offset={stats["target_offset"]}:linear=true:print_format=json')
    wav=AUDIO/f'{name}.wav';mp3=AUDIO/f'{name}.mp3'
    run(['ffmpeg','-y','-hide_banner','-nostats','-i',str(processed),'-af',filt,'-ar',str(rate),'-c:a','pcm_s16le',str(wav)])
    run(['ffmpeg','-y','-hide_banner','-nostats','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-id3v2_version','3',
         '-metadata',f'title={score["title"]}','-metadata','artist=Small Machines','-metadata','album=Zwei Maschinen, drei Momente',
         '-metadata',f'track={index+1}/3','-metadata','date=2026','-metadata','genre=Electronic','-metadata',f'comment=Original SID/65 + PAULA/68 composition, {score["bpm"]} BPM',str(mp3)])
    _,pcm=wavfile.read(wav); peak=float(np.abs(pcm.astype(float)).max()/32768)
    assert peak<1 and len(pcm)==len(raw) and np.count_nonzero(pcm[-1])==0
    meter=run(['ffmpeg','-hide_banner','-nostats','-i',str(mp3),'-af','loudnorm=I=-16:TP=-1:LRA=12:print_format=json','-f','null','-'])
    measured=json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}',meter.stderr).group())
    probe=run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(mp3)])
    assert abs(float(json.loads(probe.stdout)['format']['duration'])-len(pcm)/rate)<.1, 'Incomplete MP3 export'
    report={'title':score['title'],'duration_seconds':len(pcm)/rate,'bpm':score['bpm'],'key':score['key'],'wav_peak_dbfs':round(20*np.log10(peak),2),'mp3_lufs':measured['input_i'],'mp3_true_peak_dbtp':measured['input_tp'],'mp3_lra':measured['input_lra'],'format':'WAV 44.1 kHz / 16-bit stereo; MP3 256 kbps stereo'}
    reports.append(report); print(json.dumps(report,ensure_ascii=False),flush=True)
(ROOT/'audio-report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n')
