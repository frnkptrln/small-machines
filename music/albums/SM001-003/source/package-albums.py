"""Build listening copies, eight-track editions, and the editable score archive."""
from pathlib import Path
import hashlib,html,json,re,shutil,subprocess,unicodedata,wave,zipfile,concurrent.futures
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'releases';OUT.mkdir(exist_ok=True)
catalogue=json.loads((ROOT/'catalogue/catalogue.json').read_text())
def run(args):
    p=subprocess.run(args,stdin=subprocess.DEVNULL,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    return p
def slug(s):
    s=s.replace('ö','oe').replace('ä','ae').replace('ü','ue').replace('ß','ss')
    return re.sub(r'[^A-Za-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode()).strip('-')
def clock(t):
    t=round(t);return f'{t//60}:{t%60:02d}'
def meta(s): return str(s).replace('\\','\\\\').replace('=','\\=').replace(';','\\;').replace('#','\\#').replace('\n',' ')
def zipped(folder,path):
    hashes={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file() and p.name!='SHA256.json'}
    (folder/'SHA256.json').write_text(json.dumps(hashes,indent=2,ensure_ascii=False)+'\n')
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file():z.write(p,str(Path(folder.name)/p.relative_to(folder)))
    with zipfile.ZipFile(path) as z:assert z.testzip() is None

reports=[]
colors={'sid':('#102b35','#f0bd75','#81d7bd'),'paula':('#f3ead7','#cc634e','#386553'),'duo':('#201c36','#d5b1ec','#edb777')}
def package_album(album):
    engine=album['engine'];label='SID-und-PAULA' if engine=='duo' else engine.upper()
    name=f'{album["catalogue_number"]}-{label}-{slug(album["title"])}'
    folder=ROOT/'work'/name;folder.mkdir(exist_ok=True);(folder/'audio').mkdir(exist_ok=True)
    concat=[];metadata=[';FFMETADATA1'];total=0;trackinfo=[]
    for track in album['tracks']:
        id=track['id'];audio=ROOT/'audio'/f'{id}.wav'
        with wave.open(str(audio)) as w:
            rate=w.getframerate();frames=w.getnframes();assert rate==44100
        start=total;total+=frames
        metadata+=['[CHAPTER]','TIMEBASE=1/44100',f'START={start}',f'END={total}',f'title={meta(track["title"])}']
        concat.append("file '"+str(audio)+"'")
        file=f'{track["number"]:02d}-{slug(track["title"])}.mp3'
        shutil.copyfile(ROOT/'audio'/f'{id}.mp3',folder/'audio'/file)
        trackinfo.append({**track,'file':'audio/'+file,'start_seconds':start/rate,'seconds':frames/rate})
    (folder/'Tracks.json').write_text(json.dumps(trackinfo,indent=2,ensure_ascii=False)+'\n')
    (folder/'Playlist.m3u').write_text('#EXTM3U\n'+''.join(f'#EXTINF:{round(t["seconds"])},{t["title"]}\n{t["file"]}\n' for t in trackinfo))
    concatfile=ROOT/'work'/f'{name}-concat.txt';concatfile.write_text('\n'.join(concat)+'\n')
    metafile=ROOT/'work'/f'{name}-chapters.txt';metafile.write_text('\n'.join(metadata)+'\n')
    full=OUT/f'{name}.mp3'
    run(['ffmpeg','-y','-nostdin','-hide_banner','-nostats','-f','concat','-safe','0','-i',str(concatfile),'-i',str(metafile),'-map','0:a','-map_chapters','1','-c:a','libmp3lame','-b:a','192k','-id3v2_version','3','-metadata','artist=Small Machines','-metadata',f'album={album["title"]}','-metadata',f'title={album["title"]} — vollständiges Album','-metadata','date=2026','-metadata','genre=Electronic',str(full)])
    info=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration:chapters','-of','json',str(full)]).stdout)
    assert abs(float(info['format']['duration'])-total/44100)<.1
    assert len(info['chapters'])==8
    # Check the actual continuous encode, including its codec overshoots.
    meter=run(['ffmpeg','-nostdin','-hide_banner','-nostats','-i',str(full),'-af','loudnorm=I=-17:TP=-1:LRA=12:print_format=json','-f','null','-'])
    measured=json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}',meter.stderr).group())
    assert float(measured['input_tp'])<-.3, 'Insufficient encoded peak headroom'
    bg,accent,second=colors[engine]
    shapes=[]
    if engine=='paula':
        for x,y,size in [(280,480,64),(460,365,85),(650,510,73),(795,340,55)]:
            shapes.append(f'<path d="M{x} 780 Q{x-90} 610 {x} {y}" fill="none" stroke="{second}" stroke-width="9"/>')
            for dx,dy in [(size,0),(-size,0),(0,size),(0,-size)]: shapes.append(f'<circle cx="{x+dx*.62}" cy="{y+dy*.62}" r="{size*.54}" fill="{accent}"/>')
            shapes.append(f'<rect x="{x-17}" y="{y-17}" width="34" height="34" fill="{bg}"/>')
    elif engine=='sid':
        for i,x in enumerate(range(150,900,100)):
            y=250+(i*83%230);shapes.append(f'<path d="M{x} 790 V{y} H{x+55} V790" fill="none" stroke="{accent if i%2 else second}" stroke-width="5"/>')
        shapes.append(f'<path d="M110 600 H280 V490 H460 V650 H650 V430 H900" fill="none" stroke="{accent}" stroke-width="12"/>')
    else:
        for x,col in [(195,accent),(565,second)]:shapes.append(f'<rect x="{x}" y="280" width="250" height="360" rx="125" fill="none" stroke="{col}" stroke-width="18"/>')
        shapes.append(f'<path d="M325 460 Q510 220 690 460 Q510 740 325 460" fill="none" stroke="{accent}" stroke-width="4"/>')
    title=html.escape(album['title']);subtitle=html.escape(label.replace('-',' '))
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="{bg}"/><text x="75" y="100" font-family="monospace" font-size="22" letter-spacing="6" fill="{accent}">SMALL MACHINES / {album["catalogue_number"]}</text>'+''.join(shapes)+f'<text x="75" y="865" font-family="sans-serif" font-size="{37 if engine=="duo" else 49}" font-weight="600" fill="{accent}">{title}</text><text x="78" y="927" font-family="monospace" font-size="21" letter-spacing="5" fill="{second}">{subtitle} · 8 STÜCKE · {clock(total/44100)}</text></svg>'
    (folder/'Cover.svg').write_text(svg)
    rows=''.join(f'<article><div class="no">{t["number"]:02d}</div><div><h2>{html.escape(t["title"])}</h2><p>{html.escape(t["description"])}</p><small>{clock(t["seconds"])} · {t["bpm"]} BPM · {html.escape(t["key"])}</small><audio controls preload="none" src="{t["file"]}"></audio></div></article>' for t in trackinfo)
    page='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' · Small Machines</title><style>:root{--bg:'+bg+';--ink:'+accent+';--other:'+second+'}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:5vw}header{display:grid;grid-template-columns:minmax(260px,1fr) 1fr;gap:5vw;align-items:center}img{width:100%;height:auto}h1{font-size:clamp(2rem,4vw,3.7rem);line-height:1.1;font-weight:500;letter-spacing:-.04em}p{color:var(--other)}small,.eyebrow,.no{font-family:monospace}article{display:grid;grid-template-columns:50px 1fr;gap:16px;border-top:1px solid var(--other);padding:26px 0}h2{font-size:1.4rem;font-weight:500;margin:0}article p{margin:10px 0}audio{display:block;width:min(100%,520px);margin-top:15px}section{margin-top:65px}footer{margin-top:60px;font-size:13px;color:var(--other)}a{color:inherit}@media(max-width:650px){header{grid-template-columns:1fr}main{padding:24px}h1{font-size:2.5rem}}</style><main><header><img src="Cover.svg" alt="Grafisches Albumcover"><div><div class="eyebrow">SMALL MACHINES / '+album['catalogue_number']+'</div><h1>'+title+'</h1><p>'+subtitle+'<br>8 Stücke · '+clock(total/44100)+'</p><p>Zum Hören, Wiederhören und Weiterwachsen.</p><small>19. Oktober 2026 · erste Albumfassung</small></div></header><section>'+rows+'</section><footer>Alle Instrumente stammen aus unseren virtuellen SID-/Paula-Modellen. Originale Kompositionen und synthetische Klänge.<br>Entstanden im gemeinsamen Musikprojekt von Frank und ChatGPT. Die vollständigen Partituren gibt es in der separaten Albumwerkstatt.</footer></main><script>document.querySelectorAll("audio").forEach(a=>a.addEventListener("play",()=>document.querySelectorAll("audio").forEach(b=>{if(a!==b)b.pause()})));</script></html>'
    (folder/'Album.html').write_text(page)
    (folder/'Trackliste.txt').write_text(album['title']+'\n'+label+' / '+clock(total/44100)+'\n\n'+'\n'.join(f'{t["number"]:02d}  {clock(t["seconds"]):>5}  {t["title"]}' for t in trackinfo)+'\n\nMP3 192 kbps / Stereo. Album.html ist ein lokales Hörheft; ZIP vollständig entpacken.\nDie durchgehende Albumdatei wird separat angeboten und enthält acht Kapitelmarken.\n')
    zipfile_path=OUT/f'{name}-Einzelstuecke.zip';zipped(folder,zipfile_path)
    report={'catalogue_number':album['catalogue_number'],'title':album['title'],'engine':engine,'tracks':8,'duration_seconds':total/44100,'mp3_chapters':len(info['chapters']),'mp3_lufs':measured['input_i'],'mp3_true_peak_dbtp':measured['input_tp'],'album_file':full.name,'tracks_zip':zipfile_path.name,'bytes':full.stat().st_size}
    print(json.dumps(report,ensure_ascii=False),flush=True);return report
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    reports=list(pool.map(package_album,catalogue['albums']))
(ROOT/'verification/album-report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n')
workshop=ROOT/'work/Small-Machines-Albumwerkstatt-01';workshop.mkdir(exist_ok=True)
for directory in ['source','scores','verification','catalogue']:
    shutil.copytree(ROOT/directory,workshop/directory,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
for name in ['README.txt','engine-version.json','audio-report.json']:shutil.copyfile(ROOT/name,workshop/name)
zipped(workshop,OUT/'Small-Machines-Albumwerkstatt-01.zip')
print('Album editions and workshop archive complete.',flush=True)
