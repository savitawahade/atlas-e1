// ATLAS E-1 uses scene units; this is prescribed motion, not force simulation.
export const STORY_DURATION = 36;
export const WALK_DURATION = 9;
export const WALK_SPEED = 1.45;
export const WALK_RAMP = 1.2;
export const WALK_CYCLE = 1.5;
export const FOOT_LIFT = .12;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = n => { n = clamp(n); return n*n*(3-2*n); };
const smoother = n => { n = clamp(n); return n*n*n*(10+n*(-15+6*n)); };
const mix = (a,b,u) => a+(b-a)*u;
const mixPoint = (a,b,u) => a.map((v,i)=>mix(v,b[i],u));
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const distance = (a,b) => Math.hypot(...sub(a,b));
const unit = a => mul(a,1/Math.hypot(...a));

export const LEG_DESIGNS = Object.freeze([0,1].flatMap(row=>[-1,1].map(side=>{
  const hip=[row?-1:1,2.05,side*.62],footRest=[hip[0],.2,side*.68];
  const middle=mixPoint(hip,footRest,.5),span=distance(hip,footRest);
  const kneeRest=[middle[0]+(row?-1:1)*Math.sqrt(1-span*span/4),middle[1],middle[2]];
  // Hind-left, front-right, hind-right, front-left: one lifted foot at a time.
  const order=row===1?(side===-1?0:2):(side===1?1:3);
  return Object.freeze({row,side,hip:Object.freeze(hip),footRest:Object.freeze(footRest),
    kneeRest:Object.freeze(kneeRest),upperLength:1,lowerLength:1,swingOffset:order*WALK_CYCLE/4});
})));

function quaternion(body){
  const [x,y,z]=body.rotation.map(v=>v/2),c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}
function rotate(v,q){
  const [x,y,z]=v,[qx,qy,qz,qw]=q,ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;
  return [ix*qw-iw*qx-iy*qz+iz*qy,iy*qw-iw*qy-iz*qx+ix*qz,iz*qw-iw*qz-ix*qy+iy*qx];
}
export function bodyPoint(localPoint,body){return add(rotate(localPoint,quaternion(body)),body.position);}
export function inverseBodyPoint(worldPoint,body){const [x,y,z,w]=quaternion(body);return rotate(sub(worldPoint,body.position),[-x,-y,-z,w]);}

/** Solve a fixed 1+1-unit leg on its designated forward/backward knee branch. */
export function solveLeg(hip,foot,kneeRest,upperLength=1,lowerLength=1){
  const delta=sub(foot,hip),span=Math.hypot(...delta);
  if(!Number.isFinite(span)||span<1e-9||span>upperLength+lowerLength+1e-8||span<Math.abs(upperLength-lowerLength)-1e-8)
    throw new RangeError('Foot target is outside the elephant leg workspace.');
  const axis=mul(delta,1/span),along=(upperLength**2-lowerLength**2+span**2)/(2*span);
  // Preserve the anatomical bend side, not the rest upper-link vector: that
  // vector can become parallel to the target span during a long stance and
  // reverse its projection, causing a discontinuous knee flip.
  const bendReference=[Math.sign(kneeRest[0]-hip[0])||1,0,0];
  let bend=sub(bendReference,mul(axis,dot(bendReference,axis)));
  if(Math.hypot(...bend)<1e-8){const ref=Math.abs(axis[0])<.9?[1,0,0]:[0,0,1];bend=sub(ref,mul(axis,dot(ref,axis)));}
  const knee=add(add(hip,mul(axis,along)),mul(unit(bend),Math.sqrt(Math.max(0,upperLength**2-along**2))));
  return {knee,upperLength,lowerLength};
}

// Integral of a smooth speed ramp: continuous position, speed and acceleration.
function travel(t){
  if(t<=0)return 0;
  if(t>=WALK_RAMP)return WALK_SPEED*(t-WALK_RAMP/2);
  const u=t/WALK_RAMP;
  return WALK_SPEED*WALK_RAMP*(u**3-.5*u**4);
}
function landingX(design,at){
  const stanceDuration=WALK_CYCLE*.75;
  return design.footRest[0]+travel(at)+(travel(at+stanceDuration)-travel(at))/2;
}

/** Ground-fixed stance feet, analytic IK, and a finite nine-second departure. */
export function elephantWalkAt(t){
  if(!Number.isFinite(t))throw new RangeError('Walk time must be finite.');
  const time=clamp(t,0,WALK_DURATION),swingDuration=WALK_CYCLE/4;
  let liftSum=0,shiftZ=0;
  const targets=LEG_DESIGNS.map(design=>{
    const local=time-design.swingOffset;
    if(local<0)return {design,worldFoot:[...design.footRest],contact:true,progress:0};
    const cycleIndex=Math.floor(local/WALK_CYCLE),start=design.swingOffset+cycleIndex*WALK_CYCLE;
    const elapsed=time-start,progress=clamp(elapsed/swingDuration);
    const from=cycleIndex===0?design.footRest[0]:landingX(design,start-WALK_CYCLE+swingDuration);
    const to=landingX(design,start+swingDuration);
    const lift=elapsed<swingDuration?Math.sin(Math.PI*progress)**4:0;
    liftSum+=lift;shiftZ-=design.side*.012*lift;
    return {design,worldFoot:[mix(from,to,smoother(progress)),design.footRest[1]+FOOT_LIFT*lift,design.footRest[2]],
      contact:elapsed<=1e-10||elapsed>=swingDuration-1e-10,progress};
  });
  const moving=smooth(time/WALK_RAMP);
  const body={position:[travel(time),-.05*moving-.008*liftSum,shiftZ],rotation:[shiftZ*.25,0,0]};
  const legs=targets.map(({design,worldFoot,contact,progress})=>{
    const hip=[...design.hip],foot=inverseBodyPoint(worldFoot,body);
    const {knee}=solveLeg(hip,foot,design.kneeRest,design.upperLength,design.lowerLength);
    return {side:design.side,row:design.row,hip,knee,foot,worldFoot,contact,progress};
  });
  return {body,legs,done:time>=WALK_DURATION,time};
}

const HERO={position:[8.4,5.4,11],target:[0,2.1,0]};
const orbitStart=Math.atan2(HERO.position[2],HERO.position[0]);
const preOrbit={position:[16*Math.cos(orbitStart),7.2,16*Math.sin(orbitStart)],target:[0,2.3,0]};
const CAMERA_KEYS=[
  {at:0,...HERO},{at:2.4,...HERO},
  {at:4.1,position:[5.3,4.1,6.4],target:[1.65,3,0]},
  {at:5.5,position:[5.3,4.1,6.4],target:[1.65,3,0]},
  {at:7.4,position:[6.3,5,8.6],target:[.8,2.9,0]},
  {at:8.7,position:[6.3,5,8.6],target:[.8,2.9,0]},
  {at:10.5,position:[6.6,3.3,4.4],target:[3.1,2.0,0]},
  {at:11.7,position:[6.6,3.3,4.4],target:[3.1,2.0,0]},
  {at:13.3,position:[4.8,6.5,7.4],target:[0,3.7,0]},
  {at:15,...preOrbit},
];
const CHAPTERS=[
  {at:0,phase:'PRESENCE',title:'A quiet kind of strength.',copy:'Ivory armour. A graphite skeleton. Eighteen articulated trunk segments. Explore the anatomy beneath the surface.'},
  {at:3,phase:'OPTICS',title:'The eye comes apart',copy:'The lens carrier unscrews and separates from its sensor housing.'},
  {at:6,phase:'EARS',title:'Open the listening panels',copy:'The ears hinge outward to reveal their structural ribs.'},
  {at:9,phase:'TRUNK',title:'A little more curiosity.',copy:'Tusk collars release while eighteen linked vertebrae curl, sweep and open their fingertip grip.'},
  {at:12,phase:'CORE',title:'Reveal the power core',copy:'The central module rises above the chassis and rotates for inspection.'},
  {at:15,phase:'EXPLODED',title:'One giant. Many assemblies.',copy:'The separated structure turns through three hundred degrees.'},
  {at:21,phase:'REASSEMBLE',title:'Every part returns home',copy:'The chassis closes, followed by core, tusks, ears and optics.'},
  {at:25,phase:'SETTLE',title:'Ready to move',copy:'All assemblies are seated. The elephant settles onto four feet.'},
  {at:27,phase:'DEPART',title:'Beyond the pedestal',copy:'A grounded four-leg crawl carries ATLAS out of the scene.'},
];

/** All mechanism channels are normalized. Camera motion carries the orbit. */
export function sceneAt(t){
  if(!Number.isFinite(t))throw new RangeError('Storyboard time must be finite.');
  const time=clamp(t,0,STORY_DURATION);
  const chapter=CHAPTERS.findLast(c=>time>=c.at);
  const channel=(a,b,c,d)=>smooth((time-a)/(b-a))*(1-smooth((time-c)/(d-c)));
  const explode=channel(15,17.8,21,24.5);
  const eye=channel(3,5.2,24,25),ear=channel(6,8.2,23,24),tusk=channel(9,11.2,22,23),core=channel(12,14.2,21,22);
  let camera,turn=0;
  if(time<15){
    const index=CAMERA_KEYS.findIndex((c,i)=>i&&time<c.at),a=CAMERA_KEYS[index-1],b=CAMERA_KEYS[index];
    const u=smooth((time-a.at)/(b.at-a.at));
    camera={position:mixPoint(a.position,b.position,u),target:mixPoint(a.target,b.target,u)};
  }else if(time<25){
    const fraction=time<21?(5/6)*smooth((time-15)/6):(5/6)+(1/6)*smooth((time-21)/4);
    turn=fraction;
    const settle=smooth((time-21)/4),radius=time<21?mix(16,18,smooth((time-15)/2)):mix(18,Math.hypot(HERO.position[0],HERO.position[2]),settle);
    const angle=orbitStart+fraction*Math.PI*2;
    camera={position:[Math.cos(angle)*radius,mix(7.2,HERO.position[1],settle),Math.sin(angle)*radius],target:mixPoint(preOrbit.target,HERO.target,settle)};
  }else{camera={position:[...HERO.position],target:[...HERO.target]};turn=1;}
  return {phase:chapter.phase,title:chapter.title,copy:chapter.copy,explode,eye,ear,core,tusk,
    trunk:channel(8.5,9.7,12,14.5),headLift:explode,turn,walkTime:Math.max(0,time-27),camera,
    trunkWave:.5+.5*Math.sin(time*.7)};
}
