// Hierarchical trunk motion. Link translations remain the model's own pitch;
// returned separation values are additional local offsets, never absolute poses.
export const TRUNK_CYCLE = 12;
export const TRUNK_SEPARATION = .055;
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { value = clamp(value); return value * value * (3 - 2 * value); };
const mix = (a, b, amount) => a + (b - a) * amount;
const cycle = time => ((time % TRUNK_CYCLE) + TRUNK_CYCLE) % TRUNK_CYCLE;
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return value;
};

// Curl and lift advance through the chain with a small per-link delay. The
// smooth interpolation has zero slope at every key, including the loop seam.
const KEYS = [
  {at: 0, curl: 0, lift: 0, sweep: 0, phase: 'EXTEND'},
  {at: 2, curl: 0, lift: .25, sweep: .7, phase: 'SWEEP'},
  {at: 4, curl: .2, lift: .5, sweep: 1, phase: 'CURL'},
  {at: 6, curl: 1, lift: .65, sweep: 0, phase: 'LIFT'},
  {at: 8, curl: 1, lift: 1, sweep: -1, phase: 'RELEASE'},
  {at: 10, curl: .35, lift: .35, sweep: -.7, phase: 'RETURN'},
  {at: 12, curl: 0, lift: 0, sweep: 0, phase: 'EXTEND'},
];

function gestureAt(time) {
  const q = cycle(time);
  const index = KEYS.findIndex((key, i) => i && q < key.at);
  const a = KEYS[index - 1], b = KEYS[index];
  const amount = smooth((q - a.at) / (b.at - a.at));
  return {
    curl: mix(a.curl, b.curl, amount),
    lift: mix(a.lift, b.lift, amount),
    sweep: mix(a.sweep, b.sweep, amount),
    phase: a.phase,
  };
}

/**
 * trunkPoseAt(time, {inspection:0, explode:0, count:18})
 * Returns {links:[{rotation:{x,y,z},separation:[x,y,z]}], tipCurl, gripper,
 * phase, cyclePhase}. Angles are radians; tipCurl/gripper are normalized 0..1.
 *
 * Apply link.rotation directly and add link.separation to the saved base
 * position. Preserve trunkRoot's existing .12-radian Z rotation. Do not apply
 * tipCurl a second time: it describes the distal curl already in the link
 * angles. gripper may drive separate finger hinges when those exist.
 *
 * Inspection gives a 12-second reach/sweep/curl/lift/release study. With no
 * inspection, the trunk breathes gently while standing or walking. At full
 * explosion every joint straightens and each child receives a fixed gap.
 */
export function trunkPoseAt(time, {inspection = 0, explode = 0, count = 18} = {}) {
  finite(time, 'Trunk time');
  const inspect = smooth(clamp(finite(inspection, 'Inspection amount')));
  const separated = smooth(clamp(finite(explode, 'Explosion amount')));
  if (!Number.isInteger(count) || count < 1 || count > 128) throw new RangeError('Trunk count must be an integer from 1 to 128.');
  const connected = 1 - separated;
  const density = Math.min(1, 18 / count);
  const links = Array.from({length: count}, (_, index) => {
    const u = count === 1 ? 1 : index / (count - 1);
    const delayed = gestureAt(time - .8 * u);
    const idleZ = .010 + .050 * u * u + .007 * Math.sin(time * .55 - u * 1.8) * (.35 + .65 * u);
    const idleX = .008 * Math.sin(time * .4 - u * 1.1) * u;
    const inspectionZ = .012 + .055 * u * u + .24 * Math.pow(u, 2.4) * delayed.curl
      + .070 * Math.pow(1 - u, 1.2) * delayed.lift
      + .018 * Math.sin(TAU * time / TRUNK_CYCLE - u * 2.8) * (.3 + .7 * u);
    const inspectionX = .038 * delayed.sweep * (.2 + .8 * u)
      + .007 * Math.sin(TAU * time / TRUNK_CYCLE - u * 2.2) * u;
    return {
      rotation: {
        x: mix(idleX, inspectionX, inspect) * connected * density,
        y: 0,
        z: mix(idleZ, inspectionZ, inspect) * connected * density,
      },
      separation: [0, index === 0 || separated === 0 ? 0 : -TRUNK_SEPARATION * separated, 0],
    };
  });
  const tipGesture = gestureAt(time - .8);
  const tipCurl = inspect * connected * tipGesture.curl;
  return {
    links,
    tipCurl,
    gripper: tipCurl,
    phase: separated === 1 ? 'SEPARATED' : inspect === 0 ? 'IDLE' : gestureAt(time).phase,
    cyclePhase: cycle(time) / TRUNK_CYCLE,
  };
}
