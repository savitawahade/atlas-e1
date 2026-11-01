import assert from 'node:assert/strict';
import {trunkStudyAt, closeTrunkStudyAt} from './trunk-study.mjs';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS: ${name}`); };
const arrays = ['armorLeft', 'armorRight', 'joints', 'guides'];
const scalars = ['wrist', 'jawDemo', 'articulation'];
const channels = frame => [...arrays.flatMap(key => frame[key]), ...scalars.map(key => frame[key])];
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

check('start, finish and out-of-range seeks hold exact assembled poses', () => {
  for (const time of [-20, 0, 27, 28, 100]) assert.ok(channels(trunkStudyAt(time)).every(value => value === 0));
  assert.equal(trunkStudyAt(-1).time, 0);
  assert.equal(trunkStudyAt(100).time, 28);
  assert.equal(trunkStudyAt(27.99).complete, false);
  assert.equal(trunkStudyAt(28).complete, true);
});

check('independent stage fixtures and stagger order match the teardown narrative', () => {
  for (const [time, stage] of [[0, 'establish'], [2, 'armor'], [6, 'joints'], [10, 'tendons'], [14, 'tip'], [18, 'detail'], [21, 'reassemble'], [27, 'settle']]) {
    assert.equal(trunkStudyAt(time).stage, stage);
  }
  const early = trunkStudyAt(2.5);
  assert.ok(early.armorLeft[0] > early.armorRight[0]);
  assert.ok(early.armorLeft[0] > early.armorLeft[1]);
  assert.equal(early.armorLeft[17], 0);
  assert.ok(trunkStudyAt(6).armorRight.every(value => value === 1));
  assert.ok(trunkStudyAt(10).guides.every(value => value === 1));
  assert.ok(trunkStudyAt(18).joints.every(value => value === 1));
  assert.equal(trunkStudyAt(16).jawDemo, 1);
  assert.equal(trunkStudyAt(17).jawDemo, 0);
  assert.equal(trunkStudyAt(18).wrist, 1);
});

check('reassembly seats the wrist, then guides and carriers, then distal armor', () => {
  const wrist = trunkStudyAt(22.2);
  near(wrist.wrist, 0); assert.ok(wrist.armorLeft.every(value => value === 1));
  assert.ok(wrist.joints.every(value => value === 1));
  const carriers = trunkStudyAt(24.1);
  assert.ok(carriers.guides.every(value => value === 0));
  assert.ok(carriers.joints.every(value => value === 0));
  assert.ok(carriers.armorLeft.every(value => value === 1));
  const armor = trunkStudyAt(25);
  assert.ok(armor.armorRight[17] < armor.armorRight[0]);
  assert.ok(channels(trunkStudyAt(27)).every(value => value === 0));
});

check('6,721 frames stay normalized with continuous bounded channels and focus', () => {
  let previous = trunkStudyAt(0);
  for (let sample = 0; sample <= 6720; sample++) {
    const frame = trunkStudyAt(sample / 240), values = channels(frame);
    for (const key of arrays) assert.equal(frame[key].length, 18);
    assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(frame.focusIndex >= 0 && frame.focusIndex <= 17);
    if (sample) {
      const before = channels(previous);
      values.forEach((value, i) => assert.ok(Math.abs(value - before[i]) * 240 < 2.8));
      assert.ok(Math.abs(frame.focusIndex - previous.focusIndex) * 240 < 6.2);
    }
    previous = frame;
  }
});

check('quintic ramps have matching value and slope at all choreography joins', () => {
  const edges = [0, 2, 6, 10, 11.5, 14, 15, 15.6, 16, 17, 18, 21, 22.2, 24, 28];
  for (let i = 0; i < 18; i++) edges.push(2 + i*.15, 2.9+i*.15, 2.25+i*.15, 3.15+i*.15, 6+i*.12, 7+i*.12, 6.4+i*.12, 7.4+i*.12, 24.3+i*.08, 25.4+i*.08, 24.1+i*.08, 25.2+i*.08, 22.7+i*.035, 23.5+i*.035, 22.2+i*.035, 22.9+i*.035);
  const values = time => { const frame = trunkStudyAt(time); return [...channels(frame), frame.focusIndex]; };
  for (const edge of edges) {
    const h = 1e-4, before = values(edge-h), at = values(edge), after = values(edge+h);
    at.forEach((value, i) => {
      near(before[i], after[i], .002);
      near((value-before[i])/h, (after[i]-value)/h, .01);
    });
  }
});

check('interrupt closure preserves arbitrary initial poses and closes monotonically', () => {
  for (const sourceTime of [0, 2.7, 6.9, 11.3, 16.2, 19, 23.6, 26.1, 28]) {
    const initial = trunkStudyAt(sourceTime), snapshot = structuredClone(initial);
    assert.deepEqual(channels(closeTrunkStudyAt(initial, 0)), channels(initial));
    near(closeTrunkStudyAt(initial, 0).focusIndex, initial.focusIndex);
    let previous = channels(initial);
    for (let sample = 1; sample <= 840; sample++) {
      const frame = closeTrunkStudyAt(initial, sample / 240), values = channels(frame);
      values.forEach((value, i) => {
        assert.ok(value >= 0 && value <= previous[i] + 1e-12);
        assert.ok(Math.abs(value - previous[i]) * 240 < 2.5);
      });
      previous = values;
    }
    const final = closeTrunkStudyAt(initial, 3.5);
    assert.ok(channels(final).every(value => value === 0));
    assert.equal(final.complete, true); near(final.focusIndex, 8.5);
    assert.deepEqual(initial, snapshot, 'closure must not mutate its snapshot');
  }
});

check('seek order does not affect poses and invalid inputs fail explicitly', () => {
  const expected = trunkStudyAt(16.34);
  trunkStudyAt(28); trunkStudyAt(0);
  assert.deepEqual(trunkStudyAt(16.34), expected);
  assert.throws(() => trunkStudyAt(NaN), TypeError);
  assert.throws(() => trunkStudyAt(0, {mode: 'unknown'}), RangeError);
  assert.throws(() => closeTrunkStudyAt(expected, Infinity), TypeError);
  assert.throws(() => closeTrunkStudyAt({}, 0), TypeError);
});

console.log(`\n${checks} trunk study checks passed.`);
