// Pure inspection choreography. Every value is an absolute pose channel;
// seeking backwards does not depend on any previous rendered frame.
export const TRUNK_STUDY_DURATION = 28;
export const TRUNK_STUDY_LINKS = 18;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const quintic = value => { const u = clamp(value); return clamp(u * u * u * (10 + u * (-15 + 6 * u))); };
const ramp = (time, start, end) => quintic((time - start) / (end - start));
const opened = (time, start, end, closeStart, closeEnd) => ramp(time, start, end) * (1 - ramp(time, closeStart, closeEnd));
function keyed(time, keys) {
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i][0]) {
      const [a, from] = keys[i - 1], [b, to] = keys[i];
      return from + (to - from) * ramp(time, a, b);
    }
  }
  return keys.at(-1)[1];
}

const STAGES = [
  [0, 'establish', 'The articulated trunk', 'Eighteen linked vertebrae carry the shell, tendon guides and fingertip assembly.', 'chain'],
  [2, 'armor', 'Lift away the armor', 'Paired shell panels separate in sequence, revealing the joints beneath.', 'chain'],
  [6, 'joints', 'Inside each vertebra', 'Bearing carriers and radial guides withdraw from the exposed chain.', 'joint'],
  [10, 'tendons', 'Follow the tendons', 'The articulated chain curls while its tendon routes remain visible.', 'joint'],
  [14, 'tip', 'At the fingertips', 'The wrist rings separate and the opposed fingers demonstrate their grasp.', 'tip'],
  [18, 'detail', 'Every layer revealed', 'The exposed wrist, guides, carriers and armor hold for inspection.', 'tip'],
  [21, 'reassemble', 'Return to the complete trunk', 'The wrist seats first, followed by guides, bearing carriers and outer armor.', 'tip'],
  [27, 'settle', 'Ready for motion', 'All inspection offsets are closed and the complete trunk settles into view.', 'chain'],
];

/**
 * trunkStudyAt(seconds, {mode:'tour'}) returns normalized channels for 18 links.
 * armorLeft/right, joints and guides are arrays; wrist, jawDemo and articulation
 * are scalar channels. Add their scaled offsets to each saved model transform.
 * focusIndex is continuous (0..17); focusKind is a semantic shot label. Camera
 * placement should use focusIndex continuously rather than snapping on labels.
 * Negative times hold the initial pose, times >=28 hold the completed pose.
 */
export function trunkStudyAt(seconds, {mode = 'tour'} = {}) {
  if (!Number.isFinite(seconds)) throw new TypeError('Trunk study time must be finite.');
  if (mode !== 'tour') throw new RangeError('Only the tour trunk study mode is supported.');
  const time = clamp(seconds, 0, TRUNK_STUDY_DURATION);
  const armorLeft = [], armorRight = [], joints = [], guides = [];
  for (let i = 0; i < TRUNK_STUDY_LINKS; i++) {
    const reverse = 17 - i;
    armorLeft.push(opened(time, 2 + i * .15, 2.9 + i * .15, 24.3 + reverse * .08, 25.4 + reverse * .08));
    armorRight.push(opened(time, 2.25 + i * .15, 3.15 + i * .15, 24.1 + reverse * .08, 25.2 + reverse * .08));
    joints.push(opened(time, 6 + i * .12, 7 + i * .12, 22.7 + reverse * .035, 23.5 + reverse * .035));
    guides.push(opened(time, 6.4 + i * .12, 7.4 + i * .12, 22.2 + reverse * .035, 22.9 + reverse * .035));
  }
  const stage = STAGES.findLast(entry => time >= entry[0]);
  return {
    time, duration: TRUNK_STUDY_DURATION,
    stage: stage[1], title: stage[2], copy: stage[3],
    focusIndex: keyed(time, [[0, 8.5], [2, 2], [6, 8.5], [10, 8.5], [14, 17], [21, 17], [24, 8.5], [28, 8.5]]),
    focusKind: time >= 22.2 && time < 24.1 ? 'joint' : time >= 24.1 ? 'chain' : stage[4],
    armorLeft, armorRight, joints, guides,
    wrist: opened(time, 14, 15.6, 21, 22.2),
    jawDemo: keyed(time, [[0, 0], [15, 0], [16, 1], [17, 0], [18, 1], [21, 1], [22.2, 0], [28, 0]]),
    articulation: opened(time, 10, 11.5, 21, 22.2),
    complete: seconds >= TRUNK_STUDY_DURATION,
  };
}

/** Interrupt from an immutable snapshot of the currently displayed study.
 * elapsed is seconds since the request, not the original tour clock. Position
 * is continuous at interruption; the new quintic trajectory starts at rest.
 */
export function closeTrunkStudyAt(initialFrame, elapsed) {
  if (!Number.isFinite(elapsed)) throw new TypeError('Closure time must be finite.');
  const duration = 3.5, time = clamp(elapsed, 0, duration);
  const remaining = (start, end) => 1 - ramp(time, start, end);
  const closeLinks = (name, start, end, stagger) => {
    const values = initialFrame[name];
    if (!Array.isArray(values) || values.length !== TRUNK_STUDY_LINKS || !values.every(Number.isFinite)) {
      throw new TypeError(`Initial ${name} must contain 18 finite values.`);
    }
    return values.map((value, i) => value * remaining(start + (17 - i) * stagger, end + (17 - i) * stagger));
  };
  for (const key of ['wrist', 'jawDemo', 'articulation', 'focusIndex']) {
    if (!Number.isFinite(initialFrame[key])) throw new TypeError(`Initial ${key} must be finite.`);
  }
  return {
    time, duration, stage: elapsed >= duration ? 'settle' : 'reassemble',
    title: elapsed >= duration ? 'Ready for motion' : 'Return to the complete trunk',
    copy: 'The wrist seats first, followed by guides, bearing carriers and outer armor.',
    focusIndex: initialFrame.focusIndex + (8.5 - initialFrame.focusIndex) * ramp(time, 0, duration),
    focusKind: time < 1.8 ? initialFrame.focusKind : 'chain',
    armorLeft: closeLinks('armorLeft', 1.55, 2.6, .035),
    armorRight: closeLinks('armorRight', 1.5, 2.55, .035),
    joints: closeLinks('joints', .6, 1.375, .025),
    guides: closeLinks('guides', .5, 1.3, .025),
    wrist: initialFrame.wrist * remaining(0, .8),
    jawDemo: initialFrame.jawDemo * remaining(0, .8),
    articulation: initialFrame.articulation * remaining(0, 1.2),
    complete: elapsed >= duration,
  };
}
