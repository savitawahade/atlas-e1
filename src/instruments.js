/**
 * Left instrument rail for ATLAS. All readings come from telemetryAt(...).
 * Coordinates and speed remain in scene units. The plan-view cross marks the
 * body origin, not a calculated centre of mass or a stability estimate.
 */
const LEG_ORDER = [
  ['front-left', 'FL', 'Front left'],
  ['front-right', 'FR', 'Front right'],
  ['rear-left', 'RL', 'Rear left'],
  ['rear-right', 'RR', 'Rear right'],
];

export function instrumentMarkup() {
  return `<div class="instrument-rail" aria-label="Measured motion instruments">
    <section class="inst-section inst-contact-section" aria-labelledby="inst-contact-title">
      <div class="inst-heading"><h3 id="inst-contact-title">FOOT CONTACT</h3><span>01</span></div>
      <div class="inst-summary"><strong id="inst-contact-count">— / 4</strong><span id="inst-contact-state">AWAITING POSE</span></div>
      <svg class="inst-plan" viewBox="0 0 180 174" role="img" aria-labelledby="inst-plan-title inst-plan-desc">
        <title id="inst-plan-title">Ground contact plan</title>
        <desc id="inst-plan-desc">Actual foot positions in the world X/Z plane. The cross marks the body origin. Only planted feet form the contact boundary.</desc>
        <path class="inst-grid" d="M20 38H160 M20 62H160 M20 86H160 M20 110H160 M20 134H160 M42 24V148 M66 24V148 M90 24V148 M114 24V148 M138 24V148"/>
        <path class="inst-frame" d="M20 34V24H30 M150 24H160V34 M160 138V148H150 M30 148H20V138"/>
        <path id="inst-contact-polygon" class="inst-contact-polygon" d=""/>
        <path class="inst-axis" d="M90 25V12 M86 17L90 12L94 17 M148 86H166 M161 82L166 86L161 90"/>
        <text class="inst-axis-label" x="90" y="8" text-anchor="middle">+X / FRONT</text>
        <text class="inst-axis-label" x="170" y="89">Z</text>
        <g class="inst-origin"><circle cx="90" cy="86" r="7"/><path d="M79 86H101 M90 75V97"/></g>
        ${LEG_ORDER.map(([id, label]) => `<g id="inst-foot-${id}" class="inst-foot" visibility="hidden"><circle class="inst-foot-halo" r="6"/><circle class="inst-foot-dot" r="3"/><text class="inst-foot-label" x="9" y="-8">${label}</text></g>`).join('')}
        <text class="inst-axis-label" x="90" y="164" text-anchor="middle">CROSS = BODY ORIGIN</text>
      </svg>
      <div class="inst-legend"><span><i class="inst-key inst-key-contact"></i>Planted</span><span><i class="inst-key inst-key-swing"></i>Raised</span></div>
      <p class="inst-note">World X/Z · body-centred <span id="inst-grid-scale">— units / grid</span></p>
    </section>
    <section class="inst-section inst-joints-section" aria-labelledby="inst-joints-title">
      <div class="inst-heading"><h3 id="inst-joints-title">KNEE FLEXION</h3><span>02</span></div>
      <div class="inst-bar-scale"><span>0° · straight</span><span>180°</span></div>
      <div class="inst-leg-readings">
        ${LEG_ORDER.map(([id, label, name]) => `<div class="inst-leg-row" aria-label="${name} knee flexion"><span class="inst-leg-name">${label}</span><div class="inst-angle-track"><span id="inst-angle-${id}" class="inst-angle-fill"></span></div><output id="inst-deg-${id}" class="inst-angle-value">—</output></div>`).join('')}
      </div>
      <p class="inst-note">Solved from hip, knee and ankle</p>
    </section>
    <section class="inst-section inst-attitude-section" aria-labelledby="inst-attitude-title">
      <div class="inst-heading"><h3 id="inst-attitude-title">BODY ATTITUDE</h3><span>03</span></div>
      <svg class="inst-horizon" viewBox="0 0 180 106" role="img" aria-labelledby="inst-horizon-title inst-horizon-desc">
        <title id="inst-horizon-title">Body roll and pitch</title>
        <desc id="inst-horizon-desc">Actual body rotation. Roll is rotation about the forward X axis; pitch is rotation about Z.</desc>
        <defs><clipPath id="inst-horizon-clip"><circle cx="90" cy="49" r="37"/></clipPath></defs>
        <circle class="inst-horizon-rim" cx="90" cy="49" r="40"/>
        <path class="inst-horizon-ticks" d="M90 5V11 M68 11L71 16 M112 11L109 16 M52 27L57 30 M128 27L123 30 M46 49H52 M128 49H134 M52 71L57 68 M128 71L123 68"/>
        <g clip-path="url(#inst-horizon-clip)">
          <g id="inst-horizon-plane" transform="translate(90 49)">
            <path class="inst-horizon-ground" d="M-80 0H80V90H-80Z"/>
            <path class="inst-horizon-line" d="M-70 0H70"/>
            <path class="inst-pitch-ladder" d="M-18 -15H18 M-10 -30H10 M-18 15H18 M-10 30H10"/>
          </g>
        </g>
        <path class="inst-horizon-marker" d="M61 49H79L83 53H97L101 49H119 M90 43V48"/>
        <text class="inst-axis-label" x="90" y="103" text-anchor="middle">ROLL ±30° · PITCH ±25°</text>
      </svg>
      <dl class="inst-attitude-readings"><div><dt>ROLL / X</dt><dd id="inst-roll">—</dd></div><div><dt>PITCH / Z</dt><dd id="inst-pitch">—</dd></div></dl>
      <div class="inst-speed"><span>BODY SPEED</span><strong id="inst-speed">—</strong><small>units / s</small></div>
      <p class="inst-note">Prescribed kinematics · no force model</p>
    </section>
  </div>`;
}

let mountedRoot = null;
let elements = new Map();
const textCache = new Map();
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const point = p => Array.isArray(p) && p.length >= 2 && p.every(finite);

function element(id) {
  if (!elements.has(id)) elements.set(id, document.getElementById(id));
  return elements.get(id);
}
function write(id, value) {
  const el = element(id);
  if (el && textCache.get(id) !== value) {
    el.textContent = value;
    textCache.set(id, value);
  }
}
function signedDegrees(value) {
  if (!finite(value)) return '—';
  const rounded = Math.abs(value) < .005 ? 0 : value;
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(2)}°`;
}

/**
 * Accepts the data returned by telemetryAt(frame, gait, time).
 * No elapsed-time accumulation, random inputs, or independent motion model.
 */
export function updateInstruments(data) {
  const root = document.getElementById('inst-contact-title');
  if (!root || !data) return;
  if (root !== mountedRoot) {
    mountedRoot = root;
    elements = new Map();
    textCache.clear();
  }

  const legs = Array.isArray(data.legs) ? data.legs : [];
  const knownContacts = legs.filter(leg => leg.contact).length;
  const contactCount = finite(data.contactCount) ? data.contactCount : knownContacts;
  write('inst-contact-count', `${contactCount} / ${data.legCount || 4}`);
  write('inst-contact-state', contactCount === 0 ? 'NO GROUND CONTACT' : `${contactCount} PLANTED`);

  const center = point(data.support?.center) ? data.support.center : [data.body?.position?.[0] || 0, data.body?.position?.[2] || 0];
  const footPositions = legs.map(leg => leg.worldFoot).filter(p => point(p) && p.length >= 3);
  // Fit true X/Z positions uniformly. Do not distort one axis to fill the box.
  const halfX = Math.max(1.6, ...footPositions.map(p => Math.abs(p[0] - center[0])));
  const halfZ = Math.max(1.0, ...footPositions.map(p => Math.abs(p[2] - center[1])));
  const scale = Math.min(57 / halfX, 59 / halfZ);
  write('inst-grid-scale', `${(24 / scale).toFixed(2)} units / grid`);
  const project = ([x, z]) => [90 + (z - center[1]) * scale, 86 - (x - center[0]) * scale];
  const polygon = (Array.isArray(data.support?.polygon) ? data.support.polygon : []).filter(point).map(project);
  const boundary = element('inst-contact-polygon');
  if (boundary) {
    boundary.setAttribute('d', polygon.length >= 2 ? polygon.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + (polygon.length > 2 ? ' Z' : '') : '');
    boundary.setAttribute('data-area', String(polygon.length > 2));
  }

  for (const [id] of LEG_ORDER) {
    const leg = legs.find(item => item.id === id);
    const marker = element(`inst-foot-${id}`);
    if (marker) {
      const valid = leg && point(leg.worldFoot) && leg.worldFoot.length >= 3;
      marker.setAttribute('visibility', valid ? 'visible' : 'hidden');
      if (valid) {
        const [x, y] = project([leg.worldFoot[0], leg.worldFoot[2]]);
        marker.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        marker.setAttribute('data-contact', String(Boolean(leg.contact)));
        const label = marker.querySelector('text');
        // Labels face inward at the edge of the plot, avoiding rail clipping.
        label?.setAttribute('x', x > 132 ? '-9' : '9');
        label?.setAttribute('text-anchor', x > 132 ? 'end' : 'start');
        label?.setAttribute('y', y < 39 ? '15' : '-8');
      }
    }
    const angle = leg?.kneeFlexionDeg;
    const fill = element(`inst-angle-${id}`);
    if (fill) {
      fill.style.width = finite(angle) ? `${clamp(angle, 0, 180) / 1.8}%` : '0%';
      fill.dataset.contact = String(Boolean(leg?.contact));
    }
    write(`inst-deg-${id}`, finite(angle) ? `${angle.toFixed(1)}°` : '—');
  }

  const roll = data.body?.rollDeg, pitch = data.body?.pitchDeg;
  write('inst-roll', signedDegrees(roll));
  write('inst-pitch', signedDegrees(pitch));
  const horizon = element('inst-horizon-plane');
  if (horizon) {
    horizon.setAttribute('visibility', finite(roll) && finite(pitch) ? 'visible' : 'hidden');
    if (finite(roll) && finite(pitch)) horizon.setAttribute('transform', `translate(90 49) rotate(${-clamp(roll, -30, 30)}) translate(0 ${clamp(pitch, -25, 25) * 1.2})`);
  }
  write('inst-speed', finite(data.speedUnitsPerSecond) ? data.speedUnitsPerSecond.toFixed(2) : '—');
}
