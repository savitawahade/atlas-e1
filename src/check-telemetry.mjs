import assert from 'node:assert/strict';
import {sceneAt, elephantWalkAt} from './motion.mjs';
import {telemetryAt, LEG_LAYOUT, legExplosionOffset} from './telemetry.mjs';

let count=0;
const check=(name,run)=>{run();count++;console.log(`PASS: ${name}`);};
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const at=(t,options)=>{const frame=sceneAt(t);return telemetryAt(frame,elephantWalkAt(frame.walkTime),t,options);};

check('assembled contact geometry, attitude and weighted closure',()=>{
  const data=at(0);
  assert.equal(data.assemblyPercent,100);assert.equal(data.contactCount,4);
  assert.equal(data.support.polygon.length,4);
  assert.deepEqual(data.support.center,[0,0]);
  assert.deepEqual(data.legs.map(leg=>leg.id),LEG_LAYOUT.map(leg=>leg.id));
  for(const leg of data.legs){
    near(leg.worldFoot[0],leg.row?-1:1);near(leg.worldFoot[1],.2);near(leg.worldFoot[2],leg.side*.68);
    near(leg.upperLength,1);near(leg.lowerLength,1);
    assert.ok(leg.kneeFlexionDeg>40&&leg.kneeFlexionDeg<50);
  }
  near(data.body.rollDeg,0);near(data.body.pitchDeg,0);near(data.speedUnitsPerSecond,0);
  assert.equal(data.trunk,null);
  const eyeOnly=telemetryAt({...sceneAt(0),eye:1},elephantWalkAt(0),0);
  near(eyeOnly.assemblyFraction,.91);
});

check('known right-angle joint fixture produces actual measured angles',()=>{
  const gait=elephantWalkAt(0);
  Object.assign(gait.legs[0],{hip:[0,2,0],knee:[1,2,0],foot:[1,1,0]});
  const leg=telemetryAt(sceneAt(0),gait,0).legs[0];
  near(leg.hipAngleDeg,90);near(leg.kneeFlexionDeg,90);near(leg.hipAbductionDeg,0);
  assert.equal(leg.contact,false);
});

check('exploded diagrams match displayed offsets and never claim ground support',()=>{
  const frame={...sceneAt(0),explode:1,eye:1,ear:1,tusk:1,core:1,headLift:1};
  const data=telemetryAt(frame,elephantWalkAt(0),18);
  assert.equal(data.assemblyPercent,0);assert.equal(data.contactCount,0);
  assert.deepEqual(data.support.polygon,[]);
  for(const leg of data.legs){
    near(leg.worldFoot[0],leg.row?-1.65:1.65);
    near(leg.worldFoot[1],.8);near(leg.worldFoot[2],leg.side*1.88);
    near(leg.groundClearance,.6);
    assert.deepEqual(legExplosionOffset(leg.row,leg.side,1),[(leg.row===0?.65:-.65),.6,leg.side*1.2]);
  }
});

check('walking speed is derived from actual trajectory and obeys playback rate',()=>{
  const frame={...sceneAt(0),walkTime:3},gait=elephantWalkAt(3);
  const normal=telemetryAt(frame,gait,30),slow=telemetryAt(frame,gait,30,{playbackRate:.35}),paused=telemetryAt(frame,gait,30,{playbackRate:0});
  near(normal.simulationVelocity[0],1.45,1e-6);
  near(normal.speedUnitsPerSecond,1.45,1e-5);
  near(slow.speedUnitsPerSecond,normal.speedUnitsPerSecond*.35);
  near(paused.speedUnitsPerSecond,0);
  near(paused.simulationSpeedUnitsPerSecond,normal.simulationSpeedUnitsPerSecond);
  near(at(36).speedUnitsPerSecond,0);
  const rampFrame={...sceneAt(0),walkTime:.6};
  near(telemetryAt(rampFrame,elephantWalkAt(.6),27.6).simulationVelocity[0],.725,1e-6);
});

check('901 gait frames preserve measured contacts and foot world positions',()=>{
  for(let i=0;i<=900;i++){
    const walkTime=i/100,gait=elephantWalkAt(walkTime),frame={...sceneAt(0),walkTime};
    const data=telemetryAt(frame,gait,27+walkTime);
    assert.equal(data.contactCount,gait.legs.filter(leg=>leg.contact).length);
    assert.ok(data.support.polygon.length>=3);
    for(const leg of data.legs){
      const expected=gait.legs.find(p=>p.row===leg.row&&p.side===leg.side);
      leg.worldFoot.forEach((value,axis)=>near(value,expected.worldFoot[axis]));
      assert.ok(leg.kneeFlexionDeg>=0&&leg.kneeFlexionDeg<=180);
      assert.ok(Number.isFinite(leg.hipAngleDeg));
    }
  }
});

check('body attitude and optional trunk articulation report their actual inputs',()=>{
  const gait=elephantWalkAt(0);gait.body.rotation=[.1,.2,.3];
  const data=telemetryAt(sceneAt(0),gait,0,{trunkAngles:[[0,0,0],{x:Math.PI/2,y:0,z:0}]});
  near(data.body.rollDeg,.1*180/Math.PI);near(data.body.pitchDeg,.3*180/Math.PI);near(data.body.yawDeg,.2*180/Math.PI);
  near(data.trunk.jointBendDeg[0],0);near(data.trunk.jointBendDeg[1],90);
  near(data.trunk.totalJointBendDeg,90);near(data.trunk.maxJointBendDeg,90);
});

check('telemetry is seek-order independent and rejects invalid measurements',()=>{
  const original=at(29.12);at(36);at(0);assert.deepEqual(at(29.12),original);
  const frame=sceneAt(29),gait=elephantWalkAt(frame.walkTime),before=JSON.stringify({frame,gait});
  telemetryAt(frame,gait,29);assert.equal(JSON.stringify({frame,gait}),before);
  assert.throws(()=>telemetryAt(frame,gait,NaN),TypeError);
  assert.throws(()=>telemetryAt(frame,gait,29,{playbackRate:-1}),RangeError);
  assert.throws(()=>telemetryAt({...frame,eye:NaN},gait,29),TypeError);
});

console.log(`\n${count} telemetry checks passed. Values describe kinematics and observed contacts, not forces or stability.`);
