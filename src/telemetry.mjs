import {bodyPoint, elephantWalkAt, WALK_DURATION} from './motion.mjs';

const DEG = 180 / Math.PI;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const sub = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const length = vector => Math.hypot(...vector);
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return value;
};
const point = (value, name) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${name} must contain three finite coordinates.`);
  }
  return [...value];
};

/** Positive Z is the elephant's right side when facing forward along +X. */
export const LEG_LAYOUT = Object.freeze([
  {id: 'front-left', label: 'FL', row: 0, side: -1},
  {id: 'front-right', label: 'FR', row: 0, side: 1},
  {id: 'rear-left', label: 'RL', row: 1, side: -1},
  {id: 'rear-right', label: 'RR', row: 1, side: 1},
].map(Object.freeze));

/** Same disclosure weights as the assembly readout; not a physical mass model. */
export const ASSEMBLY_WEIGHTS = Object.freeze({
  explode: .55, eye: .09, ear: .09, tusk: .09, core: .09, headLift: .09,
});

/** Shared with the renderer so the diagram describes the displayed limbs. */
export function legExplosionOffset(row, side, explode) {
  const amount = clamp(finite(explode, 'Explosion amount'));
  return [(row === 0 ? .65 : -.65) * amount, .6 * amount, side * 1.2 * amount];
}

function convexHull(points) {
  const sorted = points.map(p => [...p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((p, index) => !index || p[0] !== sorted[index - 1][0] || p[1] !== sorted[index - 1][1]);
  if (unique.length <= 2) return unique;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const chain = values => {
    const result = [];
    for (const p of values) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    return result;
  };
  return [...chain(unique).slice(0, -1), ...chain([...unique].reverse()).slice(0, -1)];
}

function walkVelocity(walkTime) {
  // The finite departure holds before its start and after its endpoint.
  if (walkTime <= 0 || walkTime >= WALK_DURATION) return [0, 0, 0];
  const delta = Math.min(.001, walkTime, WALK_DURATION - walkTime);
  const before = elephantWalkAt(walkTime - delta).body.position;
  const after = elephantWalkAt(walkTime + delta).body.position;
  return after.map((value, axis) => (value - before[axis]) / (2 * delta));
}

function trunkTelemetry(rotations) {
  if (rotations === undefined) return null;
  if (!Array.isArray(rotations)) throw new TypeError('Trunk angles must be an array.');
  const jointBendDeg = rotations.map((rotation, index) => {
    const angles = Array.isArray(rotation) ? rotation : [rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0];
    const [x, y, z] = point(angles, `Trunk joint ${index}`).map(value => value / 2);
    // Axis-angle magnitude of the renderer's XYZ Euler rotation, not a sum of
    // Euler components. Summing these magnitudes describes joint articulation.
    const qw = Math.cos(x) * Math.cos(y) * Math.cos(z) - Math.sin(x) * Math.sin(y) * Math.sin(z);
    return 2 * Math.acos(clamp(Math.abs(qw), -1, 1)) * DEG;
  });
  return {
    jointCount: jointBendDeg.length,
    jointBendDeg,
    totalJointBendDeg: jointBendDeg.reduce((sum, value) => sum + value, 0),
    maxJointBendDeg: jointBendDeg.length ? Math.max(...jointBendDeg) : 0,
  };
}

/**
 * Pure diagnostics for a rendered frame.
 *
 * telemetryAt(frame, elephantWalkAt(frame.walkTime), time, {
 *   playbackRate: 1, // 0 when paused; e.g. .35 in slow motion
 *   trunkAngles: trunkSegments.map(segment => segment.rotation), // optional
 * })
 *
 * Returns legs in LEG_LAYOUT order, signed sagittal hip angles, knee flexion
 * (0° = straight), world-space foot contacts, body attitude in degrees,
 * assemblyPercent, and speed in scene units per playback second. The separate
 * simulationVelocity/simulationSpeed fields remain per simulation second.
 * support.center is the body origin's ground projection, NOT a center of mass
 * or an assertion of balance. trunk is null unless actual joint angles arrive.
 */
export function telemetryAt(frame, gait, time, options = {}) {
  const timeS = finite(time, 'Time');
  const walkTimeS = clamp(finite(frame.walkTime ?? 0, 'Walk time'), 0, WALK_DURATION);
  const playbackRate = finite(options.playbackRate ?? 1, 'Playback rate');
  if (playbackRate < 0) throw new RangeError('Playback rate must be non-negative.');
  const channels = Object.fromEntries(Object.keys(ASSEMBLY_WEIGHTS).map(key => [key, clamp(finite(frame[key] ?? 0, key))]));
  const position = point(gait.body.position, 'Body position');
  const rotation = point(gait.body.rotation, 'Body rotation');
  const legs = LEG_LAYOUT.map(layout => {
    const source = gait.legs.find(leg => leg.row === layout.row && leg.side === layout.side);
    if (!source) throw new TypeError(`Missing ${layout.id} leg.`);
    const hip = point(source.hip, `${layout.id} hip`);
    const knee = point(source.knee, `${layout.id} knee`);
    const foot = point(source.foot, `${layout.id} foot`);
    const upper = sub(knee, hip), lower = sub(foot, knee);
    const upperLength = length(upper), lowerLength = length(lower);
    if (upperLength < 1e-9 || lowerLength < 1e-9) throw new RangeError(`${layout.id} has a zero-length link.`);
    const explosionOffset = legExplosionOffset(layout.row, layout.side, channels.explode);
    const displayedFoot = foot.map((value, axis) => value + explosionOffset[axis]);
    const worldFoot = bodyPoint(displayedFoot, gait.body);
    // Each foot's sole is .2 units below its center and stays world-upright in
    // the renderer. A floating assembly cannot be reported as a stance contact.
    const groundClearance = worldFoot[1] - .2;
    return {
      ...layout,
      hipAngleDeg: Math.atan2(upper[0], -upper[1]) * DEG,
      hipAbductionDeg: Math.atan2(upper[2], Math.hypot(upper[0], upper[1])) * DEG,
      kneeFlexionDeg: Math.acos(clamp(dot(upper, lower) / (upperLength * lowerLength), -1, 1)) * DEG,
      upperLength, lowerLength,
      worldFoot,
      groundClearance,
      contact: Boolean(source.contact) && Math.abs(groundClearance) < 1e-6,
    };
  });
  const assemblyFraction = clamp(1 - Object.entries(ASSEMBLY_WEIGHTS).reduce((sum, [key, weight]) => sum + channels[key] * weight, 0));
  const simulationVelocity = walkVelocity(walkTimeS);
  const velocity = simulationVelocity.map(value => value * playbackRate);
  const footprint = legs.map(leg => [leg.worldFoot[0], leg.worldFoot[2]]);
  return {
    timeS, walkTimeS, playbackRate, channels,
    assemblyFraction, assemblyPercent: Math.round(assemblyFraction * 100),
    simulationVelocity,
    simulationSpeedUnitsPerSecond: length(simulationVelocity),
    velocity, speedUnitsPerSecond: length(velocity),
    contactCount: legs.filter(leg => leg.contact).length, legCount: legs.length,
    legs,
    body: {position, rollDeg: rotation[0] * DEG, yawDeg: rotation[1] * DEG, pitchDeg: rotation[2] * DEG},
    support: {
      polygon: convexHull(legs.filter(leg => leg.contact).map(leg => [leg.worldFoot[0], leg.worldFoot[2]])),
      center: [position[0], position[2]],
      bounds: {
        minX: Math.min(...footprint.map(p => p[0]), position[0]),
        maxX: Math.max(...footprint.map(p => p[0]), position[0]),
        minZ: Math.min(...footprint.map(p => p[1]), position[2]),
        maxZ: Math.max(...footprint.map(p => p[1]), position[2]),
      },
    },
    trunk: trunkTelemetry(options.trunkAngles),
  };
}

export const deriveTelemetry = telemetryAt;
