// 曲の楽譜(文字で書いた旋律・和音)の書き間違いを確かめる。音そのものは tools/music-check.mjs で確かめる。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noteNumber, parseChord, parseLine, TRACKS, validateTracks } from '../src/render/music.ts';

test('音名・和音が読める', () => {
  assert.equal(noteNumber('A4'), 69);
  assert.equal(noteNumber('C4'), 60);
  assert.equal(noteNumber('Bb3'), 58);
  assert.deepEqual(parseChord('D/F#'), { root: 2, bass: 6, tones: [0, 4, 7] });
  assert.deepEqual(parseChord('Em7').tones, [0, 3, 7, 10]);
  assert.equal(parseLine('C5:4 r:2 D5 | E5:8').length, 16);
});

test('どの曲も小節の長さと和音の数が合っている', () => {
  validateTracks();
});

test('旋律の拍の頭の音は、たいてい和音の音(はずれた音だらけになっていない)', () => {
  for (const [name, track] of Object.entries(TRACKS)) {
    let total = 0;
    let inChord = 0;
    for (const key of new Set(track.form)) {
      const sec = track.sections[key];
      const lead = sec.lines?.lead;
      if (!lead) continue;
      const bars = sec.chords.split('|').map((b) => b.trim().split(/\s+/).map(parseChord));
      for (const n of parseLine(lead).notes) {
        if (n.step % 4 !== 0) continue;
        const bar = bars[Math.floor(n.step / track.steps)];
        const chord = bar[Math.floor(((n.step % track.steps) * bar.length) / track.steps)];
        const pcs = chord.tones.map((x) => (chord.root + x) % 12);
        total++;
        if (pcs.includes(n.midi % 12)) inChord++;
      }
    }
    assert.ok(total > 0, name);
    assert.ok(inChord / total >= 0.7, `${name}: 拍の頭で和音の音 ${inChord}/${total}`);
  }
});
