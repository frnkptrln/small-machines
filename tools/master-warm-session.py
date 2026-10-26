"""Create listening masters from the measured WARM session render directory."""
import array
import json
import math
import pathlib
import re
import subprocess
import sys
import wave

folder = pathlib.Path(sys.argv[1]).resolve()
def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True)
def ff(*args):
    return run(['ffmpeg','-hide_banner','-nostats','-y',*map(str,args)])

results = []
for stem, title, filename in [('bernsteinfenster','Bernsteinfenster','Bernsteinfenster'),('bernsteinfenster-besuch','Bernsteinfenster · Besuch im Hinterhof','Bernsteinfenster-Besuch-im-Hinterhof')]:
    if len(sys.argv)>2 and sys.argv[2]!=stem:
        continue
    source = folder / (stem + '-raw.wav')
    render = json.loads((folder / (stem + '-render-report.json')).read_text())
    seconds = render['seconds']
    filters = f'highpass=f=24,afade=t=out:st={seconds-2:.8f}:d=2'
    log = ff('-i', source, '-af', filters+',loudnorm=I=-18:TP=-2:LRA=20:print_format=json','-f','null','-').stderr
    analysis = json.loads(re.findall(r'\{[^{}]+\}',log)[-1])
    gain = min(-18-float(analysis['input_i']), -2-float(analysis['input_tp']))
    wav,mp3,m4a = folder/(filename+'.wav'),folder/(filename+'.mp3'),folder/(stem+'.m4a')
    metadata = ['-metadata','title='+title,'-metadata','artist=Small Machines','-metadata','album=Bernsteinfenster — WARM/06','-metadata','date=2026','-metadata','genre=Electronic']
    if '--verify-existing' not in sys.argv:
        ff('-i',source,'-af',filters+f',volume={gain:.6f}dB','-ar',44100,'-c:a','pcm_s16le',*metadata,wav)
        ff('-i',wav,'-c:a','libmp3lame','-b:a','192k',*metadata,mp3)
        ff('-i',wav,'-c:a','aac','-b:a','192k','-movflags','+faststart',*metadata,m4a)
    peak=clipped=count=0;energy=0;first=last=None
    with wave.open(str(wav),'rb') as audio:
        assert audio.getnchannels()==2 and audio.getsampwidth()==2 and audio.getframerate()==44100
        assert audio.getnframes()==render['frames']
        while block:=audio.readframes(65536):
            samples=array.array('h',block)
            if sys.byteorder!='little':samples.byteswap()
            if first is None:first=list(samples[:2])
            last=list(samples[-2:]);peak=max(peak,max(abs(s) for s in samples));clipped+=sum(abs(s)>=32767 for s in samples);count+=len(samples);energy+=sum(s*s for s in samples)
    assert not clipped and first==[0,0] and last==[0,0]
    formats=[]
    for path in [wav,mp3,m4a]:
        info=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels','-of','json',str(path)]).stdout)
        assert abs(float(info['format']['duration'])-seconds)<.1
        formats.append({'file':path.name,**info})
    log=ff('-i',mp3,'-af','ebur128=peak=true','-f','null','-').stderr
    loudness=log[log.rfind('Summary:'):];true_peak=float(re.findall(r'Peak:\s*([-\d.]+) dBFS',loudness)[-1]);assert true_peak < -1
    report={'title':title,'seconds':seconds,'sourceAnalysis':analysis,'fixedGainDb':gain,'processing':'24 Hz highpass, fixed gain, final 2 s fade; no dynamic loudness compression','pcmSamplePeakDbfs':20*math.log10(peak/32768),'pcmRmsDbfs':20*math.log10(math.sqrt(energy/count)/32768),'clippedSamples':clipped,'firstStereoFrame':first,'lastStereoFrame':last,'mp3LoudnessAndTruePeak':loudness,'formats':formats}
    (folder/(stem+'-master-report.json')).write_text(json.dumps(report,indent=2)+'\n')
    results.append(report);print(json.dumps(report),flush=True)
