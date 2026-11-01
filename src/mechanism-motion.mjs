// Pure motor kinematics. Opening a housing never scales or resets shaft phase.
// Angles are unwrapped radians; signed angular speeds are radians/second.
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const rpm = omega => omega * 60 / TAU;
const fraction = angle => ((angle / TAU) % 1 + 1) % 1;

export const MOTOR_SCHEDULE = Object.freeze([
  {start: 12, duration: 1.6, deltaOmega: 16},
  {start: 21, duration: 1.6, deltaOmega: -12},
  {start: 22.6, duration: 3.4, deltaOmega: -8},
  {start: 27, duration: 1.2, deltaOmega: 12},
].map(Object.freeze));
export const IDLE_OMEGA = 4;
export const MANUAL_OMEGA = 12;
export const FAN_RATIO = .75;
export const GEAR_RATIO = -1 / 3;

function smoothRamp(elapsed, duration) {
  if (elapsed <= 0) return {value: 0, integral: 0, derivative: 0};
  if (elapsed >= duration) return {value: 1, integral: elapsed - duration / 2, derivative: 0};
  const u = elapsed / duration;
  return {
    value: u * u * (3 - 2 * u),
    integral: duration * (u * u * u - .5 * u * u * u * u),
    derivative: 6 * u * (1 - u) / duration,
  };
}

function storyMotor(time) {
  let angle = IDLE_OMEGA * time, omega = IDLE_OMEGA, acceleration = 0;
  for (const {start, duration, deltaOmega} of MOTOR_SCHEDULE) {
    const ramp = smoothRamp(time - start, duration);
    angle += deltaOmega * ramp.integral;
    omega += deltaOmega * ramp.value;
    acceleration += deltaOmega * ramp.derivative;
  }
  return {angle, omega, acceleration};
}

/**
 * mechanismAt(time, {manual:false, core})
 *
 * Story motor: idle 4 rad/s; 12–13.6s ramps to 20 (~191 rpm);
 * 21–22.6s ramps to 8; 22.6–26s brakes to rest; 27–28.2s starts at 12.
 * `core` is intentionally ignored: housing position cannot alter a motor clock.
 *
 * Manual inspection uses 12 rad/s. Optional manualSince anchors its angle to
 * the story at the handoff timestamp, avoiding a phase jump on entering manual
 * mode. Retain that timestamp while manipulating housing controls.
 *
 * Renderer bindings:
 * rotor.rotation.x = result.rotorAngle
 * fan.group.rotation[fan.axis] = fan.base + result.fanAngle * fan.ratio
 * gear.group.rotation[gear.axis] = gear.base + result.gearAngle * gear.ratio
 *
 * The signed gear ratio deliberately counter-rotates a meshed shaft. Normalized
 * phase fields wrap 0..1 for indicators; use unwrapped Angle fields for motion.
 */
export function mechanismAt(time, options = {}) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Motor time must be finite and non-negative.');
  let motor;
  if (options.manual) {
    const manualSince = options.manualSince ?? 0;
    if (!Number.isFinite(manualSince) || manualSince < 0 || manualSince > time) {
      throw new RangeError('Manual handoff time must be between zero and the current time.');
    }
    motor = {
      angle: storyMotor(manualSince).angle + MANUAL_OMEGA * (time - manualSince),
      omega: MANUAL_OMEGA,
      acceleration: 0,
    };
  } else motor = storyMotor(time);
  const rotorAngle = motor.angle, rotorOmega = motor.omega;
  const fanAngle = rotorAngle * FAN_RATIO, fanOmega = rotorOmega * FAN_RATIO;
  const gearAngle = rotorAngle * GEAR_RATIO, gearOmega = rotorOmega * GEAR_RATIO;
  return {
    rotorAngle, rotorOmega, rotorRpm: rpm(rotorOmega), rotorAcceleration: motor.acceleration,
    fanAngle, fanOmega, fanRpm: rpm(fanOmega),
    gearAngle, gearOmega, gearRpm: rpm(gearOmega),
    rotorPhase: fraction(rotorAngle), fanPhase: fraction(fanAngle), gearPhase: fraction(gearAngle),
    running: rotorOmega > 1e-9,
    mode: options.manual ? 'manual' : 'story',
  };
}
