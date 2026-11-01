import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshEnsemble} from '../dist/ensemble-score.mjs';
import {freshWarmEnsemble} from '../dist/warm-ensemble.mjs';
import {Ensemble} from '../dist/ensemble.mjs';
import {renderSet} from '../tools/render-set.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function shortSet(warm = false) {
  const set = warm ? freshWarmEnsemble() : freshEnsemble();
  set.name = 'Custom test take'; set.bpm = 220;
  for (const scene of set.scenes) { scene.bars = 4; scene.evolution = false; }
  return set;
}
function temporary(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'small-machines-set-'));
  try { fn(dir); } finally { rmSync(dir, {recursive: true, force: true}); }
}

test('custom quartet render follows all eight scenes and writes exact little-endian engine samples', () => temporary(dir => {
  const set = shortSet(), input = join(dir, 'custom.json'), out = join(dir, 'take');
  const raw = Buffer.from(JSON.stringify(set, null, 1) + '\n'); writeFileSync(input, raw);
  const report = renderSet(input, out, {sampleRate: 8000});
  const wav = readFileSync(join(out, 'audio-raw.wav'));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt16LE(20), 3); assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), 8000); assert.equal(wav.readUInt16LE(34), 32);
  assert.equal(wav.length, 44 + report.frames * 8);
  assert.equal(wav.readUInt32LE(40), report.frames * 8);
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(report.frames, Math.ceil((32 * 240 / 220 + 4) * 8000));
  assert.equal(report.bars, 32); assert.equal(report.title, set.name);
  assert.equal(report.sceneChanges.length, 8);
  assert.equal(report.source.sha256, hash(raw)); assert.equal(report.audio.sha256, hash(wav));
  assert.deepEqual(readFileSync(join(out, 'set.json')), raw);
  assert.deepEqual(readFileSync(input), raw);
  assert.equal(report.engine.files['ensemble.mjs'], hash(readFileSync(join(root, 'dist/ensemble.mjs'))));
  assert.ok(report.peak > 0 && report.peak < 1); assert.equal(report.clippedSamples, 0);
  assert.ok(report.sceneEnergy.every(value => value > 0));
  assert.ok(report.rmsBySecond.every(Number.isFinite));
  assert.equal(wav.readFloatLE(wav.length - 4), 0);
  const engine = new Ensemble(8000, set); engine.start(true);
  for (let frame = 0; frame < 4096; frame++) {
    const sample = engine.sample();
    for (let channel = 0; channel < 2; channel++) assert.equal(wav.readFloatLE(44 + frame * 8 + channel * 4), Math.fround(sample[channel]));
  }
  for (let scene = 0; scene < 8; scene++) assert.ok(Math.abs(report.sceneChanges[scene].frame - scene * 4 * 240 / 220 * 8000) <= 1);
  assert.equal(existsSync(join(out, 'audio-raw.wav.partial')), false);
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'render-report.json'))), report);
  assert.throws(() => renderSet(input, out, {sampleRate: 8000}), /EEXIST/);
  assert.equal(hash(readFileSync(join(out, 'audio-raw.wav'))), report.audio.sha256);
  const repeated = renderSet(input, join(dir, 'repeat'), {sampleRate: 8000});
  assert.equal(repeated.audio.sha256, report.audio.sha256);
}));

test('CLI accepts a five-instrument export and preserves intentional silence', () => temporary(dir => {
  const set = shortSet(true); set.master = 0;
  const input = join(dir, 'five.json'), out = join(dir, 'five'); writeFileSync(input, JSON.stringify(set));
  const result = JSON.parse(execFileSync(process.execPath, ['tools/render-set.mjs', input, out, '8000'], {cwd: root, encoding: 'utf8'}));
  assert.equal(result.setVersion, 2); assert.equal(result.peak, 0); assert.equal(result.rms, 0);
  assert.equal(result.sceneChanges.length, 8);
  const wav = readFileSync(join(out, 'audio-raw.wav'));
  // IEEE float audio can carry either +0 or -0; both are silent samples.
  for (let offset = 44; offset < wav.length; offset += 4) assert.ok(wav.readFloatLE(offset) === 0);
}));

test('a version-2 set retains an audible WARM solo and its exported mixer', () => temporary(dir => {
  const set = shortSet(true); set.solo = 'warm';
  const input = join(dir, 'warm.json'), out = join(dir, 'warm'); writeFileSync(input, JSON.stringify(set));
  const report = renderSet(input, out, {sampleRate: 8000});
  assert.ok(report.peak > .001); assert.ok(report.rms > 0);
  assert.equal(JSON.parse(readFileSync(join(out, 'set.json'))).solo, 'warm');
  const engine = new Ensemble(8000, set); engine.start(true);
  const wav = readFileSync(join(out, 'audio-raw.wav'));
  for (let frame = 0; frame < 4096; frame++) {
    const sample = engine.sample();
    for (let channel = 0; channel < 2; channel++) assert.equal(wav.readFloatLE(44 + frame * 8 + channel * 4), Math.fround(sample[channel]));
  }
}));

test('invalid sets and rates fail before creating an output directory', () => temporary(dir => {
  const input = join(dir, 'invalid.json'), out = join(dir, 'no-take');
  for (const source of ['{', '{}', JSON.stringify({...shortSet(), bpm: 0})]) {
    writeFileSync(input, source);
    assert.throws(() => renderSet(input, out)); assert.equal(existsSync(out), false);
  }
  writeFileSync(input, JSON.stringify(shortSet()));
  for (const sampleRate of [NaN, Infinity, 0, 7999, 96001, 44100.5]) {
    assert.throws(() => renderSet(input, out, {sampleRate})); assert.equal(existsSync(out), false);
  }
  assert.throws(() => execFileSync(process.execPath, ['tools/render-set.mjs', input, out, 'bad'], {cwd: root, stdio: 'pipe'}));
  assert.equal(existsSync(out), false);
}));
