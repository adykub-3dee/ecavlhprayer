import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDays,slovakToday,cleanOneLine,cleanParagraph} from '../js/core.mjs';

test('kalendár má 40 dní 09.11.2026 až 18.12.2026',()=>{
  const days=makeDays();
  assert.equal(days.length,40);assert.equal(days[0].iso,'2026-11-09');assert.equal(days.at(-1).iso,'2026-12-18');
  assert.equal(new Set(days.map(x=>x.iso)).size,40);
});
test('slovenský čas správne funguje okolo polnoci a zmeny času',()=>{
  assert.equal(slovakToday(new Date('2026-11-08T23:30:00Z')),'2026-11-09');
  assert.equal(slovakToday(new Date('2026-11-09T22:30:00Z')),'2026-11-09');
  assert.equal(slovakToday(new Date('2026-11-09T23:30:00Z')),'2026-11-10');
  assert.equal(slovakToday(new Date('2026-07-01T22:30:00Z')),'2026-07-02');
});
test('normalizácia textu',()=>{
  assert.equal(cleanOneLine('  Ján\n  Novák  '),'Ján Novák');
  assert.equal(cleanParagraph('  Text\r\nviac\n'),'Text\nviac');
});
