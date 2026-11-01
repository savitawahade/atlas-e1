import './fonts.js';
import './walkthrough.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createElephant} from './model.js';
import {sceneAt,elephantWalkAt} from './motion.mjs';
import {mountInterface,PARTS,CHAPTERS} from './interface.js';
import {updateInstruments} from './instruments.js';
import {telemetryAt,legExplosionOffset} from './telemetry.mjs';
import {createAnnotations} from './annotations.js';
import {trunkPoseAt} from './trunk-motion.mjs';
import {trunkStudyAt,closeTrunkStudyAt,TRUNK_STUDY_DURATION} from './trunk-study.mjs';
import {mechanismAt,FAN_RATIO,GEAR_RATIO} from './mechanism-motion.mjs';

mountInterface(document.getElementById('app'));document.title='ATLAS E-1 · Fieldwork';
const $=s=>document.querySelector(s),vec=a=>new THREE.Vector3(...a),X=new THREE.Vector3(1,0,0);
const capture=Boolean(window.__CAPTURE)||new URLSearchParams(location.search).has('capture')||new URLSearchParams(location.search).has('render');
if(capture)$('#app').classList.add('capture-mode');
const renderer=new THREE.WebGLRenderer({canvas:$('#scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();scene.background=new THREE.Color('#f1f5ff');scene.fog=new THREE.Fog('#f1f5ff',28,65);
const camera=new THREE.PerspectiveCamera(35,1,.1,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=4;controls.maxDistance=28;controls.maxPolarAngle=Math.PI*.49;
const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xd9e4e1,0x28271f,.7));
const key=new THREE.DirectionalLight(0xfff2dd,2.7);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-9,right:15,top:9,bottom:-9});key.shadow.normalBias=.015;key.shadow.bias=-.0003;key.shadow.radius=4;scene.add(key);
const rim=new THREE.DirectionalLight(0xe5edff,1.7);rim.position.set(2,6,-4);scene.add(rim);
const fill=new THREE.DirectionalLight(0xfce8c7,.7);fill.position.set(6,3,7);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#000000',opacity:.19}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);
const guides=new THREE.Group();scene.add(guides);
const grid=new THREE.GridHelper(12,24,0xd7d9cc,0xe5e6db);grid.position.y=-.002;grid.material.transparent=true;grid.material.opacity=.34;guides.add(grid);
for(const r of [3.6,3.92]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.006,5,160),new THREE.MeshBasicMaterial({color:'#c5c9b9'}));ring.rotation.x=-Math.PI/2;ring.position.y=.004;guides.add(ring);}
for(let i=0;i<80;i++){const a=i/80*Math.PI*2;const tick=new THREE.Mesh(new THREE.BoxGeometry(i%5?.025:.07,.005,.006),new THREE.MeshBasicMaterial({color:'#b0b79f'}));tick.position.set(Math.cos(a)*3.82,.005,Math.sin(a)*3.82);tick.rotation.y=-a;guides.add(tick);}
const orbitGeo=new THREE.BufferGeometry().setFromPoints(Array.from({length:129},(_,i)=>new THREE.Vector3(Math.cos(i/128*Math.PI*2)*3.15,Math.sin(i/128*Math.PI*2)*3.15+2.0,0)));
const orbitGuide=new THREE.Line(orbitGeo,new THREE.LineDashedMaterial({color:'#c1c6b4',dashSize:.035,gapSize:.065,transparent:true,opacity:.65}));orbitGuide.computeLineDistances();guides.add(orbitGuide);
const model=createElephant(),{robot,head,trunkRoot,trunkSegments,trunkDetails,ears,legs,shells,eyes,tusks,core}=model;scene.add(robot);
const updateAnnotations=createAnnotations($('#annotations'),model);
$('#shell-count').textContent=String(shells.length);
const wireMaterials=new Set();robot.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])wireMaterials.add(material);});
const headBase=head.position.clone(),trunkBases=trunkSegments.map(s=>s.position.clone());
const earBases=ears.map(e=>({position:e.pivot.position.clone(),quaternion:e.pivot.quaternion.clone()}));
const eyeBases=eyes.map(e=>({position:e.group.position.clone(),quaternion:e.group.quaternion.clone()}));
const tuskBases=tusks.map(e=>({position:e.group.position.clone(),quaternion:e.group.quaternion.clone()}));
const coreBase=core.group.position.clone();
const tendonA=new THREE.Vector3(),tendonB=new THREE.Vector3(),tendonDirection=new THREE.Vector3(),tendonAxis=new THREE.Vector3(0,1,0);
const state={time:0,tour:true,paused:false,slow:false,manual:null,target:null,manualTime:0,freeCamera:false,labels:true,guides:true,cutaway:false,wireframe:false,pendingWalk:false,assemblyPlan:null,manualSince:0,motorOffset:0,cameraGoal:null,viewName:null,tourCameraBlend:false,study:null};
let last=performance.now(),lastFrame=null,lastDrawTime=0,lastDrive=null,lastStudy=null,frameDelta=1/60,partCount=0;robot.traverse(o=>{if(o.isMesh)partCount++});
const cache=new Map();function text(id,value){if(cache.get(id)!==value){$(id).textContent=value;cache.set(id,value)}}
function configCamera(config,alpha=1){const target=vec(config.target),delta=vec(config.position).sub(target);delta.multiplyScalar(.80*Math.max(1,1.1/camera.aspect));const position=target.clone().add(delta);controls.target.lerp(target,alpha);camera.position.lerp(position,alpha);controls.update();return camera.position.distanceTo(position)<.003&&controls.target.distanceTo(target)<.003;}
function cameraAtBody(config){const x=robot.position.x;return{position:[config.position[0]+x,...config.position.slice(1)],target:[config.target[0]+x,...config.target.slice(1)]};}
let noticeTimer;function notify(message){const node=$('#interaction-status');node.textContent=message;node.classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.classList.remove('visible'),2200);}
function clearPreset(){state.viewName=null;state.cameraGoal=null;for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed','false');}
const views={trunk:{position:[6.6,3.3,4.4],target:[3.1,2.0,0]},core:{position:[4.3,6.1,6.2],target:[-.1,3.8,0]},hero:{position:[9,5.8,11.5],target:[.2,1.8,0]},front:{position:[12,4.3,.1],target:[.5,1.9,0]},detail:{position:[6,4.5,7.5],target:[1.2,2.5,0]}};
const studyEase=(t,a,b)=>{const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*u*(10+u*(-15+6*u));};
function studyFrame(){return state.study?(state.study.closing?closeTrunkStudyAt(state.study.initial,state.study.closeTime):trunkStudyAt(state.study.time)):null;}
function studyDistance(frame){if(state.study?.closing)return THREE.MathUtils.lerp(state.study.initialDistance,4.1,studyEase(frame.time,0,3.5));return 4.6-1.9*studyEase(frame.time,2,5)-.65*studyEase(frame.time,13,16)+2.05*studyEase(frame.time,20,25);}
function studyCamera(frame){
  const i=Math.floor(frame.focusIndex),j=Math.min(17,i+1),a=new THREE.Vector3(),b=new THREE.Vector3();
  trunkSegments[i].getWorldPosition(a);trunkSegments[j].getWorldPosition(b);a.lerp(b,frame.focusIndex-i);
  const offset=new THREE.Vector3(3.4,.5,1.2).normalize().multiplyScalar(studyDistance(frame));
  return{position:a.clone().add(offset).toArray(),target:a.toArray()};
}
function closeStudy(exitAfter=false){
  if(!state.study)return;
  if(state.study.closing){state.study.exitAfter ||= exitAfter;state.paused=false;return;}
  const initial=studyFrame(),initialDistance=studyDistance(initial);
  state.study={...state.study,initial,initialDistance,poseTime:Math.min(state.study.time,13)-5,freezeTime:state.study.time,closing:true,closeTime:0,exitAfter};state.paused=false;state.freeCamera=false;clearPreset();
}
function updateModel(f,t){
  const gait=elephantWalkAt(f.walkTime||0),body=gait.body;robot.position.set(...body.position);robot.rotation.set(...body.rotation);
  const ex=f.explode;const study=studyFrame();lastStudy=study;
  head.position.copy(headBase).add(vec([.6*f.headLift,1.1*f.headLift,0]));head.rotation.z=Math.sin(t*.65)*.014*(1-ex);
  for(const shell of shells){shell.object.visible=!state.cutaway;const amount=shell.kind==='body'?Math.max(ex*1.7,f.core*.85):shell.kind==='trunk'?Math.max(ex*1.7,study?(shell.side<0?study.armorLeft[shell.index]:study.armorRight[shell.index])*3.2:(f.trunk||0)*.28):ex*1.7;shell.object.position.copy(shell.base).addScaledVector(shell.delta,amount);if(shell.kind==='dorsal')shell.object.position.add(vec([-1.5*f.core,.3*f.core,0]));}
  ears.forEach((e,i)=>{e.pivot.position.copy(earBases[i].position).add(vec([0,ex*.25,e.side*ex*.75]));e.pivot.quaternion.copy(earBases[i].quaternion);e.pivot.rotateY(e.side*f.ear*1.05);});
  eyes.forEach((e,i)=>{e.group.position.copy(eyeBases[i].position).addScaledVector(e.axis?.isVector3?e.axis:vec(e.axis||[0,1,0]),f.eye*.65);e.group.quaternion.copy(eyeBases[i].quaternion);e.group.rotateY(f.eye*Math.PI*2);});
  tusks.forEach((e,i)=>{e.group.position.copy(tuskBases[i].position).addScaledVector(e.delta?.isVector3?e.delta:vec(e.delta||[.6,0,0]),f.tusk);e.group.quaternion.copy(tuskBases[i].quaternion);});
  core.group.position.copy(coreBase).add(vec([0,1.8*f.core,0]));const drive=mechanismAt(t,{manual:!state.tour,manualSince:state.manualSince});
  lastDrive={...drive,rotorAngle:drive.rotorAngle+state.motorOffset,fanAngle:drive.fanAngle+state.motorOffset*FAN_RATIO,gearAngle:drive.gearAngle+state.motorOffset*GEAR_RATIO};
  core.rotor.rotation.x=lastDrive.rotorAngle;
  for(const fan of core.fans||[])fan.group.rotation[fan.axis]=fan.base+lastDrive.fanAngle*fan.ratio;
  for(const gear of core.gears||[])gear.group.rotation[gear.axis]=gear.base+lastDrive.gearAngle*gear.ratio;
  const poseTime=study?(state.study.closing?state.study.poseTime:Math.min(study.time,13)-5):t-2.5,mechanismTime=study?(state.study.closing?state.study.freezeTime:study.time):t;
  const trunkPose=trunkPoseAt(poseTime,{inspection:study?study.articulation:(f.trunk||0),explode:ex,count:trunkSegments.length});
  if(study){const idle=trunkPoseAt(t-2.5,{explode:ex}),neutral=trunkPoseAt(poseTime,{explode:ex});for(let i=0;i<18;i++)for(const axis of ['x','z'])trunkPose.links[i].rotation[axis]+=(idle.links[i].rotation[axis]-neutral.links[i].rotation[axis])*(1-study.articulation);}
  trunkSegments.forEach((segment,i)=>{const pose=trunkPose.links[i];segment.position.copy(trunkBases[i]).add(vec(pose.separation));segment.rotation.set(pose.rotation.x,pose.rotation.y,pose.rotation.z);});
  const jawAngle=study?THREE.MathUtils.lerp(.53,.07+.62*study.jawDemo,study.wrist):.07+.46*(1-trunkPose.gripper);
  for(const finger of trunkDetails.fingers)finger.group.rotation[finger.axis]=finger.base+finger.side*jawAngle*(1-ex);
  for(const part of trunkDetails.joints){const amount=study?.joints[part.index]||0;part.group.position.copy(part.base).addScaledVector(part.axis,amount*.27);part.group.quaternion.copy(part.baseQuaternion);part.group.rotateZ(Math.sin(mechanismTime*1.8-part.index*.15)*.65*amount);}
  for(const part of trunkDetails.guides){const amount=study?.guides[part.index]||0;part.group.position.copy(part.base).addScaledVector(part.axis,amount*.32);part.group.quaternion.copy(part.baseQuaternion);part.group.rotateY(Math.sin(mechanismTime*2.4-part.index*.12)*1.1*amount);}
  for(const part of trunkDetails.wristParts){const amount=study?.wrist||0,distance=part.kind==='hinge-cap'?.11:part.kind==='encoder'?.24:.21;part.group.position.copy(part.base).addScaledVector(part.axis,amount*distance);part.group.quaternion.copy(part.baseQuaternion);}
  trunkDetails.tipRotor.rotateY(.35*Math.sin(t*.65)*(1-ex)+(study?.wrist||0)*.9*Math.sin(mechanismTime*1.6));
  robot.updateMatrixWorld(true);
  for(const tendon of trunkDetails.tendons){
    tendon.from.getWorldPosition(tendonA);tendon.to.getWorldPosition(tendonB);
    tendon.mesh.parent.worldToLocal(tendonA);tendon.mesh.parent.worldToLocal(tendonB);
    tendonDirection.subVectors(tendonB,tendonA);tendon.mesh.position.copy(tendonA).add(tendonB).multiplyScalar(.5);
    tendon.mesh.scale.y=tendonDirection.length();tendon.mesh.quaternion.setFromUnitVectors(tendonAxis,tendonDirection.normalize());
  }
  $('#trunk-focus').setAttribute('aria-pressed',String(Boolean(study)||(f.trunk||0)>.5));text('#trunk-action-label',study?(study.complete?'Replay trunk study':'Trunk · '+study.stage):(f.trunk||0)>.5?'Trunk · '+trunkPose.phase.toLowerCase():'Open trunk mechanisms');

  for(const rig of legs){
    const pose=gait.legs.find(l=>l.side===rig.side&&l.row===rig.row);
    const offset=vec(legExplosionOffset(rig.row,rig.side,ex));
    const hip=vec(pose.hip),knee=vec(pose.knee),foot=vec(pose.foot);
    rig.upper.position.copy(hip).add(offset);rig.upper.quaternion.setFromUnitVectors(X,knee.clone().sub(hip).normalize());
    rig.lower.position.copy(knee).add(offset);rig.lower.quaternion.setFromUnitVectors(X,foot.clone().sub(knee).normalize());
    rig.knee.position.copy(knee).add(offset);rig.foot.position.copy(foot).add(offset);rig.foot.quaternion.copy(robot.quaternion).invert();
    if(rig.hipBearing)rig.hipBearing.position.copy(hip).add(offset);
  }
  return gait;
}
function draw(f,t){
  lastFrame=f;lastDrawTime=t;const gait=updateModel(f,t);const study=lastStudy;if(study)f={...f,title:study.title,copy:study.copy,phase:'TRUNK'};controls.minDistance=study?1.1:4;
  const done=state.tour&&t>=36,chapter=Math.max(0,CHAPTERS.findLastIndex(([,at])=>t>=at));
  for(const button of document.querySelectorAll('.chapters [data-time]'))button.setAttribute('aria-current',state.tour&&Number(button.dataset.time)===CHAPTERS[chapter][1]?'step':'false');
  text('#chapter-number',state.tour?String(chapter+1).padStart(2,'0'):'—');
  if(!state.freeCamera){const reached=configCamera(study?studyCamera(study):state.tour?f.camera:cameraAtBody(f.camera),capture||(state.tour&&!state.tourCameraBlend)?1:1-Math.exp(-frameDelta*5));if(reached)state.tourCameraBlend=false;}else if(state.cameraGoal){if(configCamera(state.cameraGoal,capture?1:1-Math.exp(-frameDelta*5)))state.cameraGoal=null;}
  const measured=telemetryAt(f,gait,t,{playbackRate:!state.tour?0:state.paused&&!capture?0:state.slow&&!capture?.35:1});updateInstruments(measured);guides.visible=state.guides;
  text('#chapter-title',done?'Until next time.':f.title);text('#chapter-copy',done?'The study is complete. Replay the sequence or reassemble Atlas to explore each mechanism.':f.copy);text('#phase',f.phase);text('#annotation',done?'Every part has a purpose.':f.title);text('#mode-label',done?'STUDY COMPLETE':'ATLAS / '+f.phase);text('#viewname',state.freeCamera?(state.viewName?state.viewName.toUpperCase()+' VIEW':'FREE ORBIT'):state.tour?'GUIDED CAMERA':'MECHANISM VIEW');
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;const closure=study?100*(1-(mean(study.armorLeft)+mean(study.armorRight))*.225-mean(study.joints)*.2-mean(study.guides)*.2-study.wrist*.15):measured.assemblyPercent;text('#assembly',Math.round(closure)+'%');text('#contacts',String(measured.contactCount)+' / 4');
  for(const [id] of PARTS){const target=state.tour?f[id]:state.target[id],moving=state.tour?(f[id]>.001&&f[id]<.999):Math.abs(f[id]-target)>.003;$('#'+id).setAttribute('aria-pressed',String(target>.5));$('#'+id).dataset.moving=String(moving);text('#'+id+' .part-indicator',moving?(state.tour?'Moving':target>f[id]?'Opening':'Closing'):f[id]>.5?(id==='trunk'?'Active':'Open'):(id==='trunk'?'Idle':'Closed'));}
  const separation=state.tour?f.explode:state.target.explode;$('#explode').value=String(separation*100);$('#explode').style.setProperty('--progress',`${separation*100}%`);text('#explodeValue',Math.round(separation*100)+'%');
  $('#app').classList.toggle('trunk-study-active',Boolean(study));$('#trunk-study-panel').hidden=!study;$('#global-chapters').hidden=Boolean(study);$('#study-chapters').hidden=!study;
  $('#timeline').max=String(study?TRUNK_STUDY_DURATION:36);$('#timeline').setAttribute('aria-label',study?'Trunk study time in seconds':'Sequence time in seconds');
  text('#timeline-caption',study?'ARMOR → JOINTS → TENDONS → GRIP → REASSEMBLE':'REVEAL → TEARDOWN → REASSEMBLE → WALK');
  if(study){text('#study-clock',study.complete?'Complete':Math.floor(study.time)+' / '+study.duration+' s');text('#study-stage',study.stage);for(const b of document.querySelectorAll('[data-study-time]'))b.setAttribute('aria-current',Number(b.dataset.studyTime)<=study.time&&study.time<Number(b.dataset.end)?'step':'false');}
  $('#timeline').value=String(study?(state.study.closing?state.study.time:study.time):state.tour?t:state.time);$('#timeline').style.setProperty('--progress',`${study?(state.study.closing?state.study.time:study.time)/28*100:(state.tour?t:state.time)/36*100}%`);text('#time',study?(study.complete?'TRUNK REASSEMBLED':Math.floor(study.time)+' / '+study.duration+' s'):state.tour?String(Math.floor(t)).padStart(2,'0')+' / 36 s':'MANUAL INSPECTION');
  $('#pause').disabled=done;$('#pause').dataset.paused=String(state.paused);$('#pause').setAttribute('aria-label',state.paused?'Resume animation':'Pause animation');text('#pause-label',done?'Complete':state.paused?'Resume':'Pause');text('#tour-label',study?'Replay trunk study':state.tour&&t>0?'Replay sequence':'Play sequence');$('#tour').title=study?'Replay the 28-second trunk mechanism study':'Play the complete 36-second mechanism study';text('#motor-rpm',String(Math.round(lastDrive.rotorRpm*(capture?1:state.paused?0:state.slow?.35:1))));$('#walk').disabled=(f.walkTime||0)>=8.99||state.pendingWalk;text('#walk-label',state.pendingWalk?'Preparing…':(f.walkTime||0)>=8.99?'Departed':'Walk away');
  controls.update();renderer.render(scene,camera);updateAnnotations(camera,state.labels,f.phase,study);
  $('#app').dataset.time=t.toFixed(5);$('#app').dataset.phase=f.phase;$('#app').dataset.contacts=String(gait.legs.filter(l=>l.contact).length);
}
for(const id of ['labels','guides','cutaway','wireframe'])$('#'+id).onclick=()=>{state[id]=!state[id];$('#'+id).setAttribute('aria-pressed',String(state[id]));if(id==='wireframe')for(const material of wireMaterials){material.wireframe=state.wireframe;material.needsUpdate=true;}notify({labels:'Mechanism labels',guides:'Spatial guides',cutaway:'Armor cutaway',wireframe:'Wireframe'}[id]+(state[id]?' enabled':' hidden'));};
function manual(preserveStudy=false){
  if(state.study&&!preserveStudy)closeStudy(true);
  if(state.tour||!state.manual){state.manual={...(lastFrame||sceneAt(0))};state.target={...state.manual};state.manualTime=state.time;state.manualSince=state.time;}
  state.tour=false;state.paused=false;state.freeCamera=false;state.pendingWalk=false;state.assemblyPlan=null;clearPreset();
}
const mechanismKeys=['eye','ear','tusk','core','explode','headLift','trunk'];
function closeAssembly(forWalk=false){manual();for(const key of mechanismKeys)state.target[key]=0;state.pendingWalk=forWalk;state.assemblyPlan={start:state.manualTime,values:{...state.manual}};state.target.phase='REASSEMBLE';state.target.title=forWalk?'Preparing for departure':'Reassembling Atlas';state.target.copy=forWalk?'The mechanisms seat themselves before the first step.':'Each assembly returns smoothly to its mounting point.';state.target.camera=views.hero;notify(forWalk?'Reassembling, then walking away':'Returning assemblies to their mounts');}
const partCopy={trunk:'Eighteen linked vertebrae curl in sequence. Tendons track each joint while the twin fingertips open, grasp and release.',eye:'Seven iris blades sit behind the lens barrel. The carrier unscrews along the optical axis to expose the sensor socket.',ear:'Curved panels swing away from the head, exposing the radial supports and rotary hinge at their roots.',tusk:'The tusks slide from paired mounting collars. Layered rings separate the ivory outer form from the graphite socket.',core:'A rotating power cassette rises from the dorsal bay, revealing its cooling fins, manifold ports and routed coolant lines.'};
for(const [id,name] of PARTS)$('#'+id).onclick=()=>{if(id==='trunk'){startStudy();return;}manual();state.target[id]=state.target[id]>.5?0:1;state.target.phase='INSPECT';state.target.title=name;state.target.copy=partCopy[id];state.target.camera=id==='core'?(state.target.core>.5?views.core:views.hero):id==='trunk'?(state.target.trunk>.5?views.trunk:views.hero):views.detail;state.target.phase=id==='trunk'?'TRUNK':'INSPECT';if(id==='trunk'&&state.target.trunk>.5){state.target.explode=0;state.target.headLift=0;}};
$('#explode').oninput=e=>{manual();const amount=+e.target.value/100;for(const key of ['explode','eye','ear','tusk','core','headLift'])state.target[key]=amount;state.target.phase='TEARDOWN';state.target.title='Every assembly, revealed';state.target.copy='Shells, optical lenses, tusk couplings and limb modules separate along their mounting axes.';state.target.camera={position:[10,7,14],target:[.1,2.25,0]};};
function startStudy(time=0){clearTimeout(noticeTimer);$('#interaction-status').classList.remove('visible');manual(true);for(const key of mechanismKeys)state.target[key]=0;state.target.trunk=1;state.target.phase='TRUNK';state.target.title='Trunk mechanism study';state.target.copy=partCopy.trunk;state.target.camera=views.trunk;state.study={time,closing:false,exitAfter:false};state.freeCamera=false;state.paused=false;}
$('#trunk-focus').onclick=()=>startStudy();
$('#study-replay').onclick=()=>startStudy();
$('#study-close').onclick=()=>closeStudy(false);
$('#study-exit').onclick=()=>{closeStudy(true);state.target.trunk=0;state.target.camera=views.hero;state.target.phase='ASSEMBLED';state.target.title='Atlas, assembled';};
for(const button of document.querySelectorAll('[data-study-time]'))button.onclick=()=>startStudy(Number(button.dataset.studyTime));
$('#assemble').onclick=()=>state.study?closeStudy(false):closeAssembly();
function play(time=0,preserveMotor=false){const offset=preserveMotor&&lastDrive?lastDrive.rotorAngle-mechanismAt(time).rotorAngle:0;Object.assign(state,{study:null,time,tour:true,paused:false,manual:null,target:null,freeCamera:false,pendingWalk:false,assemblyPlan:null,motorOffset:offset,tourCameraBlend:preserveMotor});clearPreset();draw(sceneAt(time),time);}
$('#tour').onclick=()=>{if(state.study){startStudy();return;}play();notify('Full sequence started');};
$('#walk').onclick=()=>{if(state.study||mechanismKeys.some(k=>(lastFrame?.[k]||0)>.003)){closeAssembly(true);}else{play(27+(lastFrame?.walkTime||0),true);notify('Departure started');}};
for(const button of document.querySelectorAll('.chapters [data-time]'))button.onclick=()=>{play(Number(button.dataset.time));notify(button.textContent.replace(/^0\d/,'')+' chapter');};
$('#timeline').oninput=e=>{if(state.study){startStudy(+e.target.value);state.paused=true;draw({...state.target,...Object.fromEntries(mechanismKeys.map(k=>[k,state.manual[k]]))},state.manualTime);return;}Object.assign(state,{time:+e.target.value,tour:true,paused:true,manual:null,target:null,freeCamera:false,pendingWalk:false,assemblyPlan:null,motorOffset:0,tourCameraBlend:false});clearPreset();draw(sceneAt(state.time),state.time);};
$('#slow').onchange=e=>state.slow=e.target.checked;
$('#pause').onclick=()=>state.paused=!state.paused;
function cameraView(name){state.freeCamera=true;state.viewName=name;state.cameraGoal=cameraAtBody(views[name]);for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===name));}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>cameraView(b.dataset.view);
$('#reset').onclick=()=>cameraView('hero');
controls.addEventListener('start',()=>{state.freeCamera=true;clearPreset();});
function zoom(f){state.freeCamera=true;clearPreset();const d=camera.position.clone().sub(controls.target);d.setLength(THREE.MathUtils.clamp(d.length()*f,controls.minDistance,28));camera.position.copy(controls.target).add(d);controls.update();}
$('#zoom-in').onclick=()=>zoom(.88);$('#zoom-out').onclick=()=>zoom(1.14);
$('#scene').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();state.paused=!state.paused;}else if(e.key==='Home'){e.preventDefault();cameraView('hero');}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.14:.88);}else if(e.key.startsWith('Arrow')){e.preventDefault();state.freeCamera=true;clearPreset();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0;s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0),.2,Math.PI*.49);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();}};
function resize(){const {width,height}=$('#stage').getBoundingClientRect();renderer.setSize(width,height,false);renderer.setViewport(0,0,width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(lastFrame)draw(lastFrame,lastDrawTime);}
new ResizeObserver(resize).observe($('#stage'));resize();
await document.fonts.ready;await renderer.compileAsync(scene,camera);
const captureStudy=Boolean(window.__SIM_CONFIG?.trunkStudy)||new URLSearchParams(location.search).has('trunk-study');
function renderCapture(t){if(!Number.isFinite(t)||t<0)throw new RangeError('Invalid capture time');state.freeCamera=false;state.tour=!captureStudy;state.motorOffset=0;state.tourCameraBlend=false;
  if(captureStudy){const f={...sceneAt(0),trunk:1};state.study={time:Math.min(t,28),closing:false};state.manualSince=0;state.manualTime=t;state.target=f;state.manual=f;draw(f,t);}else{state.study=null;draw(sceneAt(t),t);}}
window.SIM={ready:true,duration:captureStudy?28:36,fps:60,render:renderCapture};window.seek=renderCapture;window.DURATION=captureStudy?28:36;window.FPS=60;
if(capture)renderCapture(Number(new URLSearchParams(location.search).get('time')||0));
else{if(captureStudy)startStudy();last=performance.now();function loop(now){
  frameDelta=Math.max(0,Math.min(.1,(now-last)/1000));const dt=frameDelta*(state.slow?.35:1);last=now;
  if(!state.paused){
    if(state.tour){state.time=Math.min(36,state.time+dt);if(state.time===36)state.paused=true;}
    else{state.manualTime+=dt;if(state.study){if(state.study.closing){state.study.closeTime=Math.min(3.5,state.study.closeTime+dt);if(state.study.closeTime>=3.5&&state.study.exitAfter)state.study=null;}else state.study.time=Math.min(28,state.study.time+dt);}
      for(const k of mechanismKeys){if(state.assemblyPlan){const timings={core:[0,.6],tusk:[.45,.65],ear:[.9,.65],eye:[1.35,.65],trunk:[0,1.6],explode:[0,1.9],headLift:[0,1.9]},[delay,duration]=timings[k];state.manual[k]=state.assemblyPlan.values[k]*(1-THREE.MathUtils.smoothstep(state.manualTime-state.assemblyPlan.start,delay,delay+duration));}else state.manual[k]+=(state.target[k]-state.manual[k])*(1-Math.exp(-dt*6));}
      const settled=mechanismKeys.every(k=>Math.abs(state.manual[k]-state.target[k])<.001);
      if(settled&&state.pendingWalk&&!state.study){play(27+(state.manual.walkTime||0),true);}
      else if(settled&&state.target.phase==='REASSEMBLE'){state.assemblyPlan=null;state.target.phase='ASSEMBLED';state.target.title='Ready to move';state.target.copy='All assemblies are seated. Inspect a subsystem or start the next walk.';}
    }
  }
  if(state.tour)draw(sceneAt(state.time),state.time);else draw({...state.target,...Object.fromEntries(mechanismKeys.map(k=>[k,state.manual[k]]))},state.manualTime);
  requestAnimationFrame(loop);
}requestAnimationFrame(loop);}
