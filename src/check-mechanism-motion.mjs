import assert from 'node:assert/strict';
import {mechanismAt, FAN_RATIO, GEAR_RATIO} from './mechanism-motion.mjs';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS: ${name}`); };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);

check('independent integrated-phase fixtures through inspection and closing', () => {
  // Each ramp's area is duration × average endpoint velocity.
  for (const [time, angle, omega] of [
    [0, 0, 4], [12, 48, 4], [12.8, 53.6, 12], [13.6, 67.2, 20],
    [21, 215.2, 20], [21.8, 229.4, 14], [22.6, 237.6, 8],
    [24.3, 248.65, 4], [26, 251.2, 0], [27, 251.2, 0],
    [27.6, 252.55, 6], [28.2, 258.4, 12], [36, 352, 12],
  ]) {
    const result = mechanismAt(time);
    near(result.rotorAngle, angle); near(result.rotorOmega, omega);
  }
  near(mechanismAt(16).rotorRpm, 190.9859317102744);
  assert.equal(mechanismAt(26.5).running, false);
});

check('60,001 sampled motor frames remain finite, forward, and acceleration-bounded', () => {
  let previous = mechanismAt(0);
  for (let i = 0; i <= 60000; i++) {
    const result = mechanismAt(i / 1000);
    for (const [key, value] of Object.entries(result)) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} is not finite`);
    assert.ok(result.rotorOmega >= -1e-10 && result.rotorOmega <= 20 + 1e-10);
    assert.ok(result.rotorAngle >= previous.rotorAngle - 1e-9, 'shaft reverses');
    assert.ok(Math.abs(result.rotorAcceleration) <= 15 + 1e-9);
    assert.ok(result.rotorRpm <= 200);
    for (const key of ['rotorPhase', 'fanPhase', 'gearPhase']) assert.ok(result[key] >= 0 && result[key] < 1);
    near(result.fanAngle, result.rotorAngle * FAN_RATIO);
    near(result.gearAngle, result.rotorAngle * GEAR_RATIO);
    previous = result;
  }
});

check('analytic speed and rpm match derivatives of the rendered shaft angle', () => {
  const h = 1e-4;
  for (let time = .013; time < 36; time += .037) {
    const before = mechanismAt(time - h), at = mechanismAt(time), after = mechanismAt(time + h);
    const omega = (after.rotorAngle - before.rotorAngle) / (2 * h);
    near(omega, at.rotorOmega, 2e-6);
    near(omega * 60 / (2 * Math.PI), at.rotorRpm, 2e-5);
    near((after.rotorOmega - before.rotorOmega) / (2 * h), at.rotorAcceleration, 2e-6);
  }
});

check('phase, velocity, and acceleration stay continuous across ramp boundaries', () => {
  for (const time of [12, 13.6, 21, 22.6, 26, 27, 28.2]) {
    const before = mechanismAt(time - 1e-7), after = mechanismAt(time + 1e-7);
    near(before.rotorAngle, after.rotorAngle, 5e-6);
    near(before.rotorOmega, after.rotorOmega, 1e-6);
    near(before.rotorAcceleration, after.rotorAcceleration, 1e-5);
  }
});

check('opening and closing the housing cannot change shaft phase', () => {
  for (const time of [0, 12, 15, 21, 22, 23.4, 25, 26, 30]) {
    const closed = mechanismAt(time, {core: 0});
    for (const core of [.2, .5, 1]) assert.deepEqual(mechanismAt(time, {core}), closed);
    const manual = mechanismAt(time, {manual: true, core: 0});
    for (const core of [.2, .5, 1]) assert.deepEqual(mechanismAt(time, {manual: true, core}), manual);
    near(manual.rotorOmega, 12);
    near(manual.rotorAngle, time * 12);
  }
});

check('manual inspection can inherit the exact story angle at handoff', () => {
  for (const handoff of [0, 7, 12.8, 20, 24, 26.5, 30]) {
    near(mechanismAt(handoff, {manual: true, manualSince: handoff}).rotorAngle, mechanismAt(handoff).rotorAngle);
    near(mechanismAt(handoff + 1, {manual: true, manualSince: handoff}).rotorAngle, mechanismAt(handoff).rotorAngle + 12);
  }
});

check('seven-blade fans and coordinated 24/12-tooth gears remain below 30 pattern passes per second', () => {
  const peak = mechanismAt(16);
  assert.ok(Math.abs(peak.fanRpm) * 7 / 60 < 30);
  const primaryRate = Math.abs(peak.gearRpm) * 24 / 60;
  const pinionRate = Math.abs(peak.gearRpm * -2) * 12 / 60;
  near(primaryRate, pinionRate);
  assert.ok(primaryRate < 30);
});

check('out-of-order sampling is repeatable and invalid time is rejected', () => {
  const expected = mechanismAt(23.14); mechanismAt(35); mechanismAt(0);
  assert.deepEqual(mechanismAt(23.14), expected);
  for (const time of [NaN, Infinity, -1]) assert.throws(() => mechanismAt(time), RangeError);
  assert.throws(() => mechanismAt(3, {manual: true, manualSince: 4}), RangeError);
});

console.log(`\n${checks} motor checks passed. Shaft phases are integrated, deterministic, and independent of housing opening.`);
