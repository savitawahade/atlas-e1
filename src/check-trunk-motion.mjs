import assert from 'node:assert/strict';
import {trunkPoseAt, TRUNK_CYCLE, TRUNK_SEPARATION} from './trunk-motion.mjs';
import {sceneAt, elephantWalkAt, bodyPoint} from './motion.mjs';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS: ${name}`); };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);

check('default chain keeps all links connected and has gentle positive forward curl', () => {
  const pose = trunkPoseAt(0);
  assert.equal(pose.links.length, 18); assert.equal(pose.phase, 'IDLE');
  for (const link of pose.links) {
    assert.deepEqual(link.separation, [0, 0, 0]);
    assert.ok(link.rotation.z > 0 && link.rotation.z < .07);
    assert.ok(Math.abs(link.rotation.x) < .009);
  }
  near(pose.gripper, 0);
});

check('inspection progresses through extend, sweep, curl, lift and release', () => {
  for (const [time, phase] of [[0, 'EXTEND'], [2, 'SWEEP'], [4, 'CURL'], [6, 'LIFT'], [8, 'RELEASE'], [10, 'RETURN']]) {
    assert.equal(trunkPoseAt(time, {inspection: 1}).phase, phase);
  }
  near(trunkPoseAt(2.8, {inspection: 1}).tipCurl, 0);
  near(trunkPoseAt(6.8, {inspection: 1}).tipCurl, 1);
  near(trunkPoseAt(8.8, {inspection: 1}).gripper, 1);
  near(trunkPoseAt(10.8, {inspection: 1}).gripper, .35);
  const lift = trunkPoseAt(7.5, {inspection: 1});
  const idle = trunkPoseAt(7.5);
  const total = pose => pose.links.reduce((sum, link) => sum + link.rotation.z, 0);
  assert.ok(total(lift) > total(idle) + .8, 'inspection needs a visibly stronger curl than idle');
  assert.ok(total(lift) < Math.PI, 'whole trunk must not fold completely back into its own base');
});

check('14,401 inspection frames have finite bounded link angles and no whipping', () => {
  let previous = trunkPoseAt(0, {inspection: 1});
  for (let i = 0; i <= 14400; i++) {
    const pose = trunkPoseAt(i / 240, {inspection: 1});
    assert.ok(pose.tipCurl >= 0 && pose.tipCurl <= 1);
    assert.ok(pose.gripper >= 0 && pose.gripper <= 1);
    for (let j = 0; j < pose.links.length; j++) {
      const {rotation, separation} = pose.links[j];
      assert.ok(Object.values(rotation).every(Number.isFinite));
      assert.ok(Math.abs(rotation.x) <= .045 && Math.abs(rotation.z) <= .33);
      assert.deepEqual(separation, [0, 0, 0]);
      if (i) {
        assert.ok(Math.abs(rotation.x - previous.links[j].rotation.x) * 240 < .25);
        assert.ok(Math.abs(rotation.z - previous.links[j].rotation.z) * 240 < .25);
      }
    }
    previous = pose;
  }
});

check('full explosion straightens and freezes the chain without moving its root', () => {
  for (const time of [0, 1, 5, 7.2, 100]) {
    const pose = trunkPoseAt(time, {inspection: 1, explode: 1});
    assert.equal(pose.phase, 'SEPARATED'); near(pose.tipCurl, 0); near(pose.gripper, 0);
    for (let i = 0; i < pose.links.length; i++) {
      for (const value of Object.values(pose.links[i].rotation)) near(value, 0);
      near(pose.links[i].separation[1], i === 0 ? 0 : -TRUNK_SEPARATION);
    }
  }
});

check('period seam and link-delayed key transitions are continuous', () => {
  const a = trunkPoseAt(0, {inspection: 1}), b = trunkPoseAt(TRUNK_CYCLE, {inspection: 1});
  for (let i = 0; i < 18; i++) for (const axis of ['x', 'z']) near(a.links[i].rotation[axis], b.links[i].rotation[axis]);
  for (let i = 0; i < 18; i++) for (const edge of [0, 2, 4, 6, 8, 10, 12]) {
    const time = edge + .8 * i / 17;
    const before = trunkPoseAt(time - 1e-6, {inspection: 1});
    const after = trunkPoseAt(time + 1e-6, {inspection: 1});
    for (const axis of ['x', 'z']) near(before.links[i].rotation[axis], after.links[i].rotation[axis], 1e-6);
  }
});

check('inspection and separation amounts blend continuously at their limits', () => {
  for (const boundary of [0, 1]) {
    for (const field of ['inspection', 'explode']) {
      const before = trunkPoseAt(7, {[field]: boundary - 1e-6});
      const after = trunkPoseAt(7, {[field]: boundary + 1e-6});
      for (let i = 0; i < 18; i++) {
        for (const axis of ['x', 'z']) near(before.links[i].rotation[axis], after.links[i].rotation[axis], 1e-8);
        near(before.links[i].separation[1], after.links[i].separation[1], 1e-8);
      }
    }
  }
});

check('story and manual inspection keep articulated trunk envelopes above the floor', () => {
  // Independent forward traversal of the renderer's actual hierarchical
  // transforms. Spheres conservatively enclose the segment and fingertip.
  const worldPoint = (point, transforms) => transforms.reduceRight((p, transform) => bodyPoint(p, transform), point);
  for (let sample = 0; sample <= 1080; sample++) {
    const time = sample / 30;
    for (const frame of [sceneAt(time), {trunk: 1, explode: 0, headLift: 0, walkTime: 0}]) {
      const pose = trunkPoseAt(time - 2.5, {inspection: frame.trunk || 0, explode: frame.explode});
      const transforms = [
        elephantWalkAt(frame.walkTime || 0).body,
        {position: [1.45 + .6 * frame.headLift, 2.85 + 1.1 * frame.headLift, 0], rotation: [0, 0, Math.sin(time * .65) * .014 * (1 - frame.explode)]},
        {position: [.85, -.1, 0], rotation: [0, 0, .12]},
      ];
      for (let index = 0; index < 18; index++) {
        const link = pose.links[index], radius = .24 - (.24 - .085) * index / 17;
        transforms.push({position: [0, (index ? -.13 : 0) + link.separation[1], 0], rotation: [link.rotation.x, 0, link.rotation.z]});
        const center = worldPoint([0, -.065, 0], transforms);
        assert.ok(center[1] - Math.hypot(radius, .065) > .08, `segment ${index} floor clearance at ${time}s`);
      }
      const tip = worldPoint([0, -.24, 0], transforms);
      assert.ok(tip[1] - .13 > .08, `finger envelope floor clearance at ${time}s`);
    }
  }
});

check('variable link counts remain bounded and arbitrary seeks are repeatable', () => {
  for (const count of [1, 6, 18, 36, 64, 128]) {
    const pose = trunkPoseAt(7.3, {inspection: 1, count});
    assert.equal(pose.links.length, count);
    assert.ok(pose.links.reduce((sum, link) => sum + link.rotation.z, 0) < Math.PI);
  }
  const expected = trunkPoseAt(5.73, {inspection: .8, explode: .2});
  trunkPoseAt(30); trunkPoseAt(0);
  assert.deepEqual(trunkPoseAt(5.73, {inspection: .8, explode: .2}), expected);
  for (const count of [0, 2.5, 129]) assert.throws(() => trunkPoseAt(0, {count}), RangeError);
  assert.throws(() => trunkPoseAt(Infinity), TypeError);
  assert.throws(() => trunkPoseAt(0, {inspection: NaN}), TypeError);
});

console.log(`\n${checks} trunk checks passed. Rendered plate clearance and fingertip geometry still need visual inspection.`);
