// Render an exported ENSEMBLE/04 or ENSEMBLE/05 set without a browser.
import {createHash} from 'node:crypto';
import {closeSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, writeSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Ensemble, validateEnsemble} from '../dist/ensemble.mjs';
import {setSeconds} from '../dist/ensemble-score.mjs';

const engineDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const TAIL_SECONDS = 4;

function floatHeader(frames, rate) {
  const bytes = frames * 8;
  if (!Number.isSafeInteger(bytes) || bytes + 36 > 0xffffffff) throw new Error('Set exceeds the RIFF WAV size limit at this sample rate.');
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + bytes, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 8, 28);
  header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(bytes, 40);
  return header;
}

/** Output is a fresh directory. A report is written only after the full set ends. */
export function renderSet(input, output, {sampleRate = 44100} = {}) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Sample rate must be an integer from 8000 to 96000.');
  const inputPath = resolve(input), directory = resolve(output);
  if (statSync(inputPath).size > 16_000_000) throw new Error('Set file exceeds 16 MB.');
  const source = readFileSync(inputPath);
  const set = validateEnsemble(JSON.parse(source.toString('utf8')));
  const musicSeconds = setSeconds(set), frames = Math.ceil((musicSeconds + TAIL_SECONDS) * sampleRate);
  const header = floatHeader(frames, sampleRate);
  const engine = new Ensemble(sampleRate, structuredClone(set));
  const engineHashes = Object.fromEntries(readdirSync(engineDirectory).filter(name => name.endsWith('.mjs')).sort()
    .map(name => [name, sha256(readFileSync(join(engineDirectory, name)))]));
  // Exclusive directory creation prevents overwriting a previous take or input.
  mkdirSync(resolve(directory, '..'), {recursive: true});
  mkdirSync(directory);
  writeFileSync(join(directory, 'set.json'), source, {flag: 'wx'});
  const partial = join(directory, 'audio-raw.wav.partial');
  const fd = openSync(partial, 'wx'), audioHash = createHash('sha256');
  let peak = 0, clipped = 0, energy = 0, secondEnergy = 0, secondFrames = 0;
  const rmsBySecond = [], sceneEnergy = Array(set.scenes.length).fill(0);
  const block = Buffer.alloc(16384 * 8);
  function write(bytes) {
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      if (count === 0) throw new Error('Audio write made no progress.');
      offset += count;
    }
    audioHash.update(bytes);
  }
  engine.start(true);
  try {
    write(header);
    for (let done = 0; done < frames;) {
      const count = Math.min(16384, frames - done);
      for (let i = 0; i < count; i++) {
        const sample = engine.sample(), frame = done + i;
        if (engine.error) throw new Error(engine.error);
        const fade = Math.min(1, (frames - 1 - frame) / (sampleRate * .5));
        for (let channel = 0; channel < 2; channel++) {
          const value = Math.fround(sample[channel] * fade);
          if (!Number.isFinite(value)) throw new Error('Nonfinite audio.');
          block.writeFloatLE(value, i * 8 + channel * 4);
          peak = Math.max(peak, Math.abs(value));
          if (Math.abs(value) >= 1) clipped++;
          energy += value * value / 2;
          secondEnergy += value * value / 2;
          sceneEnergy[engine.sceneIndex] += value * value / 2;
        }
        secondFrames++;
        if (secondFrames === sampleRate) {
          rmsBySecond.push(Math.sqrt(secondEnergy / secondFrames));
          secondEnergy = 0; secondFrames = 0;
        }
      }
      write(block.subarray(0, count * 8));
      done += count;
    }
    if (!engine.ended || engine.sceneChanges.length !== set.scenes.length || clipped) throw new Error('Incomplete or clipped performance.');
  } finally { closeSync(fd); }
  if (secondFrames) rmsBySecond.push(Math.sqrt(secondEnergy / secondFrames));
  const report = {
    title: set.name, setVersion: set.version, bpm: set.bpm,
    bars: set.scenes.reduce((sum, scene) => sum + scene.bars, 0),
    sampleRate, channels: 2, format: 'IEEE Float32 little-endian', frames,
    musicSeconds, tailSeconds: TAIL_SECONDS, seconds: frames / sampleRate,
    peak, clippedSamples: clipped, rms: Math.sqrt(energy / frames), rmsBySecond, sceneEnergy,
    sceneChanges: engine.sceneChanges.map(change => ({...change, seconds: change.frame / sampleRate, name: set.scenes[change.scene].name})),
    source: {file: 'set.json', sha256: sha256(source)},
    audio: {file: 'audio-raw.wav', sha256: audioHash.digest('hex')},
    engine: {files: engineHashes},
    renderer: {file: 'tools/render-set.mjs', sha256: sha256(readFileSync(fileURLToPath(import.meta.url)))},
    runtime: {node: process.version, platform: process.platform, arch: process.arch},
  };
  renameSync(partial, join(directory, report.audio.file));
  writeFileSync(join(directory, 'render-report.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node tools/render-set.mjs SET.json NEW_OUTPUT_DIRECTORY [SAMPLE_RATE]\nDefault sample rate: 44100. Writes raw Float32 stereo WAV, the exact set and a render report.');
  } else {
    try {
      if (args.length < 2 || args.length > 3) throw new Error('Usage: node tools/render-set.mjs SET.json NEW_OUTPUT_DIRECTORY [SAMPLE_RATE]');
      const report = renderSet(args[0], args[1], {sampleRate: args[2] === undefined ? 44100 : Number(args[2])});
      console.log(JSON.stringify({...report, rmsBySecond: undefined, sceneEnergy: undefined, engine: undefined}, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
