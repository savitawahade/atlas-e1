import assert from 'node:assert/strict';
import {sceneAt,elephantWalkAt,LEG_DESIGNS,STORY_DURATION,WALK_DURATION,bodyPoint,inverseBodyPoint,solveLeg} from './motion.mjs';

let checks=0;
const check=(name,run)=>{run();checks++;console.log(`PASS: ${name}`);};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const nearPoint=(a,b,tolerance=1e-8)=>near(distance(a,b),0,tolerance);
const channels=['explode','eye','ear','core','tusk','headLift','turn','trunkWave','trunk'];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const unit=a=>a.map(v=>v/Math.hypot(...a));

check('independent rest geometry and exact one-unit links',()=>{
  const rest=elephantWalkAt(0);
  nearPoint(rest.body.position,[0,0,0]);nearPoint(rest.body.rotation,[0,0,0]);
  assert.equal(rest.legs.length,4);
  for(const leg of rest.legs){
    const d=LEG_DESIGNS.find(d=>d.row===leg.row&&d.side===leg.side);
    nearPoint(leg.hip,[leg.row?-1:1,2.05,leg.side*.62]);
    nearPoint(leg.foot,[leg.row?-1:1,.2,leg.side*.68]);
    near(leg.knee[1],1.125);near(leg.knee[2],leg.side*.65);
    near(distance(leg.hip,leg.knee),1);near(distance(leg.knee,leg.foot),1);
    nearPoint(leg.knee,d.kneeRest);
    assert.ok((leg.knee[0]-leg.hip[0])*(leg.row?-1:1)>0,'knees use their designated bend branch');
    assert.equal(leg.contact,true);
  }
});

check('3,601 storyboard frames have finite bounded channels and camera',()=>{
  for(let i=0;i<=3600;i++){
    const frame=sceneAt(i/100);
    for(const key of channels)assert.ok(Number.isFinite(frame[key])&&frame[key]>=0&&frame[key]<=1,`${key} invalid at${i/100}`);
    for(const p of [frame.camera.position,frame.camera.target])assert.ok(p.every(Number.isFinite));
    assert.ok(distance(frame.camera.position,frame.camera.target)>1);
    assert.ok(frame.walkTime>=0&&frame.walkTime<=9);
    assert.ok(frame.phase&&frame.title&&frame.copy);
  }
});

check('storyboard reveals the intended components in order',()=>{
  const fixtures=[
    [0,'PRESENCE'],[3,'OPTICS'],[6,'EARS'],[9,'TRUNK'],[12,'CORE'],
    [15,'EXPLODED'],[21,'REASSEMBLE'],[25,'SETTLE'],[27,'DEPART'],
  ];
  for(const [time,phase] of fixtures)assert.equal(sceneAt(time).phase,phase);
  near(sceneAt(5.5).eye,1);near(sceneAt(8.5).ear,1);near(sceneAt(11.5).tusk,1);near(sceneAt(14.5).core,1);
  near(sceneAt(18).explode,1);near(sceneAt(11.5).trunk,1);
  near(sceneAt(21).turn,5/6);
  const startAngle=Math.atan2(sceneAt(15).camera.position[2],sceneAt(15).camera.position[0]);
  let unwrapped=0,previous=startAngle;
  for(let i=1;i<=600;i++){
    const camera=sceneAt(15+i/100).camera.position,angle=Math.atan2(camera[2],camera[0]);
    let delta=angle-previous;if(delta< -Math.PI)delta+=2*Math.PI;if(delta>Math.PI)delta-=2*Math.PI;
    unwrapped+=delta;previous=angle;
  }
  near(unwrapped,5*Math.PI/3);
});

check('all assemblies are seated before departure and camera stays at the pedestal',()=>{
  for(const time of [25,26,27,30,36]){
    const frame=sceneAt(time);
    for(const channel of ['explode','eye','ear','core','tusk','headLift'])near(frame[channel],0);
    assert.deepEqual(frame.camera,sceneAt(25).camera);
  }
  near(sceneAt(27).walkTime,0);near(sceneAt(36).walkTime,9);
  for(let t=0;t<27;t+=.1)near(sceneAt(t).walkTime,0);
});

check('component and camera transforms are continuous at every stage boundary',()=>{
  const boundaries=[2.4,3,4.1,5.2,5.5,6,7.4,8.2,8.7,9,10.5,11.2,11.7,12,13.3,14.2,15,17,17.8,21,22,23,24,24.5,25,27,36];
  for(const edge of boundaries){
    const a=sceneAt(edge-1e-6),b=sceneAt(edge+1e-6);
    for(const key of channels)near(a[key],b[key],1e-5);
    nearPoint(a.camera.position,b.camera.position,1e-4);
    nearPoint(a.camera.target,b.camera.target,1e-4);
  }
});

check('9,001 walking frames keep links rigid and at least three feet grounded',()=>{
  let previous=null;
  for(let i=0;i<=9000;i++){
    const frame=elephantWalkAt(i/1000);
    assert.ok(frame.body.position.every(Number.isFinite)&&frame.body.rotation.every(Number.isFinite));
    assert.ok(frame.legs.filter(leg=>leg.contact).length>=3);
    for(let index=0;index<frame.legs.length;index++){
      const leg=frame.legs[index];
      near(distance(leg.hip,leg.knee),1);near(distance(leg.knee,leg.foot),1);
      nearPoint(bodyPoint(leg.foot,frame.body),leg.worldFoot);
      assert.ok(leg.worldFoot[1]>=.2-1e-10,'feet cannot enter the floor');
      assert.ok(leg.worldFoot[1]<=.320000001,'foot lift must stay small');
      if(leg.contact)near(leg.worldFoot[1],.2);
      if(previous){
        const before=previous.legs[index];
        if(before.contact&&leg.contact)nearPoint(before.worldFoot,leg.worldFoot);
        assert.ok(distance(before.knee,leg.knee)<.1,'knee branch must not snap');
      }
    }
    previous=frame;
  }
});

check('departure starts without a pose jump and ends with 12.18 units of travel',()=>{
  const start=elephantWalkAt(0),first=elephantWalkAt(1e-6),last=elephantWalkAt(9);
  nearPoint(start.body.position,first.body.position,1e-6);
  for(let i=0;i<4;i++)nearPoint(start.legs[i].knee,first.legs[i].knee,1e-6);
  near(last.body.position[0],12.18);
  assert.equal(last.done,true);
  assert.ok(last.legs.every(leg=>leg.contact));
  assert.deepEqual(elephantWalkAt(20),last);
  assert.deepEqual(elephantWalkAt(-1),start);
});

check('assembled elephant bounding box exits the 35-degree, 1.61-aspect camera by 36 seconds',()=>{
  // Conservative assembled extents: rear -2.2, front +3.6, height5, width3.2.
  // The root renderer uses this exact35-degree camera and an aspect near1.61.
  const camera=sceneAt(36).camera,body=elephantWalkAt(9).body;
  const forward=unit(sub(camera.target,camera.position));
  const right=unit([-forward[2],0,forward[0]]);
  const horizontalSlope=Math.tan(35*Math.PI/360)*1.61;
  for(const x of [-2.2,3.6])for(const y of [0,5])for(const z of [-1.6,1.6]){
    const relative=sub(bodyPoint([x,y,z],body),camera.position);
    const depth=dot(relative,forward),lateral=dot(relative,right);
    assert.ok(depth>0&&lateral>depth*horizontalSlope,'entire assembled bounding box must be outside the right frustum');
  }
});

check('arbitrary render order does not change story or gait and inputs are validated',()=>{
  const frames=new Map([0,3.1,6.7,12.2,18,24.5,27,33,36].map(t=>[t,sceneAt(t)]));
  for(const t of [33,0,36,3.1,18,24.5,6.7,12.2,27])assert.deepEqual(sceneAt(t),frames.get(t));
  const walk=elephantWalkAt(4.12);elephantWalkAt(8);elephantWalkAt(0);assert.deepEqual(elephantWalkAt(4.12),walk);
  assert.deepEqual(sceneAt(-1),sceneAt(0));assert.deepEqual(sceneAt(100),sceneAt(STORY_DURATION));
  for(const bad of [NaN,Infinity,-Infinity]){assert.throws(()=>sceneAt(bad),RangeError);assert.throws(()=>elephantWalkAt(bad),RangeError);}
  assert.throws(()=>solveLeg(LEG_DESIGNS[0].hip,[100,0,0],LEG_DESIGNS[0].kneeRest),RangeError);
  const body=elephantWalkAt(2.37).body,point=[.4,2.4,-.8];nearPoint(inverseBodyPoint(bodyPoint(point,body),body),point);
});

console.log(`\n${checks} ATLAS checks passed. Rendered shell contacts, lens threads and assembled bounds still require visual verification.`);
