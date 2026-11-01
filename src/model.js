import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LEG_DESIGNS} from './motion.mjs';

const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const v=a=>new THREE.Vector3(...a);
const material=(color,metalness=.25,roughness=.42)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
function group(parent,p=[0,0,0]){const g=new THREE.Group();g.position.set(...p);parent.add(g);return g}
function mesh(geo,mat,parent,p=[0,0,0]){const m=new THREE.Mesh(geo,mat);m.position.set(...p);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function bar(parent,a,b,r,mat,r2=r){const d=v(b).sub(v(a)),m=mesh(new THREE.CylinderGeometry(r2,r,d.length(),20),mat,parent);m.position.copy(v(a).add(v(b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(Y,d.normalize());return m}
function ring(parent,p,r,thickness,mat,axis=[1,0,0]){const m=mesh(new THREE.TorusGeometry(r,thickness,8,48),mat,parent,p);m.quaternion.setFromUnitVectors(Z,v(axis).normalize());return m}
function ellipsoid(parent,p,scale,mat){const m=mesh(new THREE.SphereGeometry(1,40,28),mat,parent,p);m.scale.set(...scale);return m}
function tube(parent,points,r,mat){const curve=new THREE.CatmullRomCurve3(points.map(v));const segments=Math.max(16,Math.min(192,Math.ceil(curve.getLength()*48)));return mesh(new THREE.TubeGeometry(curve,segments,r,8,false),mat,parent)}
function alongX(parent,a,b){const g=group(parent,a);g.quaternion.setFromUnitVectors(X,v(b).sub(v(a)).normalize());return g}
function sectionAt(stations,x){
  let k=stations.findIndex((s,i)=>i&&x<=s[0]);if(k<1)k=x<=stations[0][0]?1:stations.length-1;
  const a=stations[Math.max(0,k-2)],b=stations[k-1],c=stations[k],d=stations[Math.min(stations.length-1,k+1)];
  const u=THREE.MathUtils.clamp((x-b[0])/(c[0]-b[0]||1),0,1);
  return b.map((value,i)=>i===0?value+(c[i]-value)*u:.5*((2*value)+(-a[i]+c[i])*u+(2*a[i]-5*value+4*c[i]-d[i])*u*u+(-a[i]+3*value-3*c[i]+d[i])*u*u*u));
}
function surfacePoint(stations,x,angle,offset=0){const [,cy,cz,ry,rz]=sectionAt(stations,x);return[x,cy+Math.cos(angle)*(ry+offset),cz+Math.sin(angle)*(rz+offset)]}
function surfacePatch(parent,stations,x0,x1,angle,span,mat,lift=.012){
  const positions=[],indices=[],nx=18,na=12;
  for(let i=0;i<=nx;i++)for(let j=0;j<=na;j++)positions.push(...surfacePoint(stations,x0+(x1-x0)*i/nx,angle-span/2+span*j/na,lift));
  for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a=i*(na+1)+j,b=a+na+1;indices.push(a,a+1,b,b,a+1,b+1)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(geo,mat,parent);
}
function loft(stations,start=0,sweep=Math.PI*2,n=40){
  // Smooth longitudinal curvature plus a real return lip: armor stays solid
  // when separated, and its highlights no longer break at four flat sections.
  const refined=[];
  for(let j=0;j<stations.length-1;j++)for(let step=0;step<5;step++){
    const u=step/5,a=stations[Math.max(0,j-1)],b=stations[j],c=stations[j+1],d=stations[Math.min(stations.length-1,j+2)];
    refined.push(b.map((value,k)=>k===0?value+(c[k]-value)*u:.5*((2*value)+(-a[k]+c[k])*u+(2*a[k]-5*value+4*c[k]-d[k])*u*u+(-a[k]+3*value-3*c[k]+d[k])*u*u*u)));
  }
  refined.push(stations.at(-1));
  const p=[],indices=[],ringCount=n+1,layerSize=refined.length*ringCount;
  for(let layer=0;layer<2;layer++)for(const [x,cy,cz,ry,rz] of refined){
    const wall=layer*Math.min(.025,Math.min(ry,rz)*.22);
    for(let i=0;i<=n;i++){const a=start+sweep*i/n;p.push(x,cy+(ry-wall)*Math.cos(a),cz+(rz-wall)*Math.sin(a))}
  }
  for(let j=0;j<refined.length-1;j++)for(let i=0;i<n;i++){
    const a=j*ringCount+i,b=a+ringCount;indices.push(a,b,a+1,b,b+1,a+1);
    const c=a+layerSize,d=b+layerSize;indices.push(c,c+1,d,d,c+1,d+1);
  }
  for(let i=0;i<n;i++)for(const row of [0,refined.length-1]){
    const a=row*ringCount+i,b=a+layerSize;indices.push(a,a+1,b,b,a+1,b+1);
  }
  if(sweep<Math.PI*2-.001)for(let j=0;j<refined.length-1;j++)for(const edge of [0,n]){
    const a=j*ringCount+edge,b=a+ringCount,c=a+layerSize,d=b+layerSize;indices.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function taperTube(parent,points,startRadius,endRadius,mat){
  const curve=new THREE.CatmullRomCurve3(points.map(v)),n=64,r=12,g=new THREE.TubeGeometry(curve,n,startRadius,r,false),positions=g.attributes.position;
  for(let i=0;i<positions.count;i++){const t=Math.floor(i/(r+1))/n,c=curve.getPoint(t),scale=(startRadius+(endRadius-startRadius)*t)/startRadius;positions.setXYZ(i,c.x+(positions.getX(i)-c.x)*scale,c.y+(positions.getY(i)-c.y)*scale,c.z+(positions.getZ(i)-c.z)*scale)}
  g.computeVertexNormals();return mesh(g,mat,parent);
}

// Standard 20-degree involute flanks. Both exposed gears use the same module;
// their pitch radii, center distance, and speed ratio therefore agree.
function spurGearGeometry(teeth,pitchRadius,depth){
  const alpha=20*Math.PI/180,module=2*pitchRadius/teeth;
  const base=pitchRadius*Math.cos(alpha),root=pitchRadius-1.25*module,tip=pitchRadius+module;
  const backlash=.0012;
  const halfPitch=Math.PI/(2*teeth)-backlash/(2*pitchRadius),invPitch=Math.tan(alpha)-alpha;
  const flankAt=r=>{const a=Math.acos(Math.min(1,base/r));return halfPitch+invPitch-(Math.tan(a)-a)};
  const outline=new THREE.Shape();let first=true;
  const point=(r,a)=>{const x=r*Math.cos(a),y=r*Math.sin(a);if(first){outline.moveTo(x,y);first=false}else outline.lineTo(x,y)};
  for(let tooth=0;tooth<teeth;tooth++){
    const center=tooth*Math.PI*2/teeth,halfStep=Math.PI/teeth;
    point(root,center-halfStep);point(root,center-flankAt(base));
    for(let k=0;k<=5;k++){const r=base+(tip-base)*k/5;point(r,center-flankAt(r))}
    for(let k=1;k<=3;k++)point(tip,center-flankAt(tip)+2*flankAt(tip)*k/3);
    for(let k=4;k>=0;k--){const r=base+(tip-base)*k/5;point(r,center+flankAt(r))}
    point(root,center+flankAt(base));point(root,center+halfStep);
  }
  outline.closePath();
  const shaft=new THREE.Path();shaft.absarc(0,0,teeth>16?.032:.023,0,Math.PI*2,true);outline.holes.push(shaft);
  if(teeth>16)for(let i=0;i<5;i++){const a=i*Math.PI*2/5,hole=new THREE.Path();hole.absarc(Math.cos(a)*.096,Math.sin(a)*.096,.036,0,Math.PI*2,true);outline.holes.push(hole)}
  return new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSize:.0004,bevelThickness:.0007,bevelSegments:1,curveSegments:12});
}

// Batch decorative details only inside a rigid component. Every animated or
// extractable node is a traversal boundary, so the renderer retains its exact
// object references and material controls while bolts share fewer draw calls.
function batchRigidDetails(robot,boundaries){
  const protectedNodes=new Set(boundaries);robot.updateMatrixWorld(true);
  for(const root of boundaries){
    const inverse=root.matrixWorld.clone().invert(),batches=new Map();
    function collect(object){
      if(protectedNodes.has(object))return;
      if(object.isMesh&&!Array.isArray(object.material)){
        const signature=Object.entries(object.geometry.attributes).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}`).sort().join(',');
        const key=`${object.material.uuid}/${signature}/${!!object.geometry.index}/${object.castShadow}/${object.receiveShadow}`;
        if(!batches.has(key))batches.set(key,[]);batches.get(key).push(object);
      }
      for(const child of object.children)collect(child);
    }
    for(const child of root.children)collect(child);
    for(const objects of batches.values()){
      if(objects.length<2)continue;
      const geometries=objects.map(object=>object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld)));
      const combined=mergeGeometries(geometries,false);
      geometries.forEach(g=>g.dispose());if(!combined)continue;
      const merged=mesh(combined,objects[0].material,root);merged.castShadow=objects[0].castShadow;merged.receiveShadow=objects[0].receiveShadow;
      for(const object of objects)object.removeFromParent();
    }
  }
}

export function createElephant(){
  const robot=new THREE.Group(),shells=[],legs=[],ears=[],eyes=[],tusks=[],trunkSegments=[];
  const ivory=new THREE.MeshPhysicalMaterial({color:'#cfcab9',metalness:.28,roughness:.31,clearcoat:.28,clearcoatRoughness:.25,side:THREE.DoubleSide});
  const pale=ivory.clone();pale.color.set('#e6e0d0');
  const ceramic=ivory.clone();ceramic.color.set('#2850e8');ceramic.roughness=.38;
  const graphite=material('#222825',.72,.35),rubber=material('#101614',.06,.72),steel=material('#87938e',.9,.26),bronze=material('#ab6837',.8,.35),orange=material('#ff673f',.48,.37);
  const optic=new THREE.MeshPhysicalMaterial({color:'#4d7666',metalness:.1,roughness:.08,clearcoat:1,transmission:.72,thickness:.04,ior:1.46,envMapIntensity:.65});
  const glow=material('#ed9353',.35,.3);glow.emissive.set('#652504');glow.emissiveIntensity=.3;
  function shell(object,delta,kind='body',metadata={}){object.material=object.material.clone();shells.push({object,base:object.position.clone(),delta:v(delta),kind,...metadata});return object}
  function bolt(parent,p,r=.021,axis=[0,0,1]){const g=group(parent,p);g.quaternion.setFromUnitVectors(Y,v(axis).normalize());mesh(new THREE.CylinderGeometry(r,r,.017,12),steel,g);mesh(new THREE.CylinderGeometry(r*.5,r*.5,.002,6),rubber,g,[0,.009,0]);return g}
  function bearing(parent,p,r=.2){
    const g=group(parent,p);bar(g,[0,0,-r*.72],[0,0,r*.72],r,graphite);
    for(const s of [-1,1]){
      bar(g,[0,0,s*r*.7],[0,0,s*r*.84],r*.9,steel);
      ring(g,[0,0,s*r*.86],r*.72,.012,bronze,[0,0,1]);ring(g,[0,0,s*r*.88],r*.5,.007,rubber,[0,0,1]);
      bar(g,[0,0,s*r*.85],[0,0,s*r*.92],r*.37,graphite);bolt(g,[0,0,s*r*.94],r*.15,[0,0,s]);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;bolt(g,[Math.cos(a)*r*.69,Math.sin(a)*r*.69,s*r*.86],r*.065,[0,0,s])}
    }
    return g;
  }
  function label(parent,text,p,width=.6,height=.09,rotation=[0,0,0]){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const ctx=canvas.getContext('2d');ctx.font='600 38px monospace';ctx.fillStyle='#36423a';ctx.textBaseline='middle';ctx.fillText(text,10,48);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),parent,p);m.rotation.set(...rotation);m.castShadow=false;return m;
  }
  function latch(parent,p,normal,width=.11){
    const g=group(parent,p);g.quaternion.setFromUnitVectors(Y,v(normal).normalize());
    mesh(new THREE.BoxGeometry(width+.025,.014,.075),graphite,g);
    mesh(new THREE.BoxGeometry(width,.022,.049),orange,g,[0,.017,0]);
    bar(g,[-width*.28,.032,0],[width*.28,.032,0],.008,steel);
    return g;
  }

  // Load-bearing graphite cage; the shell can open without moving the skeleton.
  for(const side of [-1,1]){
    bar(robot,[-1.55,2.15,side*.48],[1.2,2.15,side*.48],.11,graphite);
    bar(robot,[-1.5,2.8,side*.4],[1.15,2.8,side*.4],.07,steel);
    for(let i=0;i<4;i++){const x=-1.4+i*.75;bar(robot,[x,2.12,side*.48],[x+.38,2.8,side*.4],.045,steel);}
    tube(robot,[[-1.6,2.05,side*.55],[-.8,1.95,side*.61],[.35,2.0,side*.59],[1.2,2.25,side*.45]],.045,orange);
    tube(robot,[[-1.4,2.8,side*.4],[-.5,2.97,side*.4],[.6,2.9,side*.43],[1.3,2.65,side*.38]],.038,rubber);
    for(let cable=0;cable<3;cable++){
      const y=2.08+cable*.052;
      tube(robot,[[-1.5,y+.16,side*.69],[-1.12,y+.06,side*.79],[-.35,y,side*.9],[.42,y+.02,side*.86],[1.08,y+.15,side*.65]],cable===1?.022:.016,cable===1?orange:graphite);
    }
    for(const [x,y,z]of[[-1.12,2.18,.8],[-.35,2.16,.91],[.42,2.17,.87]]){
      const clip=group(robot,[x,y,side*z]);mesh(new THREE.BoxGeometry(.052,.19,.034),steel,clip);mesh(new THREE.BoxGeometry(.025,.115,.045),graphite,clip,[0,0,side*.02]);
    }
  }
  for(const x of [-1.35,-.65,.1,.85]){
    tube(robot,Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[x,2.3+Math.cos(a)*.7,Math.sin(a)*.64]}),.055,graphite);
    bar(robot,[x,1.85,-.5],[x,1.85,.5],.075,steel);
  }
  // Three broad longitudinal bays, four independently removable curved plates.
  const bodySections=[
    [[-1.8,2.3,0,.35,.36],[-1.62,2.3,0,.64,.61],[-1.15,2.3,0,.84,.77],[-.72,2.3,0,.9,.83]],
    [[-.68,2.3,0,.9,.83],[-.3,2.3,0,.94,.87],[.15,2.3,0,.91,.86],[.58,2.3,0,.85,.8]],
    [[.62,2.3,0,.84,.79],[.94,2.3,0,.72,.7],[1.25,2.3,0,.52,.56],[1.4,2.3,0,.34,.4]],
  ];
  bodySections.forEach((section,bay)=>{
    for(let quadrant=0;quadrant<4;quadrant++){
      const start=quadrant*Math.PI/2+.025,sweep=Math.PI/2-.05,mid=start+sweep/2,side=Math.sign(Math.sin(mid)),top=Math.cos(mid)>0;
      const plate=shell(mesh(loft(section,start,sweep),top?pale:ivory,robot),[bay===0?-.12:bay===2?.12:0,top?.62:-.24,side*.55],'body');
      for(const angle of [start,start+sweep])tube(plate,section.map(([x,y,z,ry,rz])=>[x,y+Math.cos(angle)*ry,z+Math.sin(angle)*rz]),.011,bronze);
      for(const x of [section[0][0]+.012,section.at(-1)[0]-.012]){
        tube(plate,Array.from({length:19},(_,j)=>surfacePoint(section,x,start+sweep*j/18,-.012)),.018,rubber);
        tube(plate,Array.from({length:19},(_,j)=>surfacePoint(section,x,start+sweep*j/18,.003)),.006,steel);
      }
      for(const station of [section[1],section.at(-2)]){const [x,y,z,ry,rz]=station;bolt(plate,[x,y+Math.cos(mid)*ry,z+Math.sin(mid)*rz],.017,[0,Math.cos(mid),Math.sin(mid)])}
      const begin=section[0][0],end=section.at(-1)[0],width=end-begin;
      for(const f of [.18,.82]){
        const x=begin+width*f,a=mid+(top?(side>0?.39:-.39):0);
        latch(plate,surfacePoint(section,x,a,.014),[0,Math.cos(a),Math.sin(a)],.09);
      }
      for(const f of [.32,.68])tube(plate,Array.from({length:17},(_,j)=>surfacePoint(section,begin+width*f,start+.15+(sweep-.3)*j/16,.006)),.006,graphite);
      if(top&&bay!==1){
        const x0=begin+width*.18,x1=end-width*.16,angle=mid+(side>0?.13:-.13),span=.58;
        surfacePatch(plate,section,x0,x1,angle,span,graphite);
        for(const a of [angle-span/2,angle+span/2])tube(plate,Array.from({length:13},(_,j)=>surfacePoint(section,x0+(x1-x0)*j/12,a,.017)),.01,steel);
        for(let j=1;j<10;j++){const x=x0+(x1-x0)*j/10;tube(plate,Array.from({length:7},(_,k)=>surfacePoint(section,x,angle-.24+k*.08,.024)),.015,j===1||j===9?orange:steel);}
      }else if(top){
        const a=mid+(side>0?.23:-.23),p=surfacePoint(section,-.08,a,.024),hatch=group(plate,p);hatch.quaternion.setFromUnitVectors(Y,v([0,Math.cos(a),Math.sin(a)]));
        mesh(new THREE.CylinderGeometry(.258,.258,.11,48),graphite,hatch,[0,-.035,0]);
        mesh(new THREE.CylinderGeometry(.218,.218,.023,48),ceramic,hatch,[0,.023,0]);
        ring(hatch,[0,.034,0],.225,.012,steel,[0,1,0]);ring(hatch,[0,.038,0],.153,.009,graphite,[0,1,0]);
        mesh(new THREE.BoxGeometry(.19,.023,.046),graphite,hatch,[0,.041,0]);
        for(let j=0;j<3;j++){const b=j*Math.PI*2/3;latch(hatch,[Math.cos(b)*.232,.034,Math.sin(b)*.232],[0,1,0],.075);}
        for(let j=0;j<12;j++){const b=j*Math.PI/6;bar(hatch,[Math.cos(b)*.175,.041,Math.sin(b)*.175],[Math.cos(b)*.192,.041,Math.sin(b)*.192],.004,graphite);}
      }
      if(bay===1&&!top)label(plate,side>0?'ATLAS / E—1':'FIELDWORK',[-.29,2.13,side*.866],.75,.105,[0,side<0?Math.PI:0,0]);
    }
  });
  // Raised dorsal spine and small service slats make the broad body read as a
  // manufactured assembly without shrinking it into a collection of cylinders.
  const dorsalStations=[[-1.3,3.13,0,.07,.15],[-.8,3.24,0,.075,.2],[0,3.24,0,.075,.2],[.75,3.05,0,.06,.13]];
  const dorsal=shell(mesh(loft(dorsalStations),ceramic,robot),[0,.9,0],'dorsal');
  for(let i=0;i<10;i++){
    const x=-1.12+i*.18,k=dorsalStations.findIndex((s,j)=>j&&x<=s[0]),a=dorsalStations[k-1],b=dorsalStations[k],u=(x-a[0])/(b[0]-a[0]);
    const cy=a[1]+(b[1]-a[1])*u,ry=a[3]+(b[3]-a[3])*u,rz=a[4]+(b[4]-a[4])*u;
    tube(dorsal,[-1,-.5,0,.5,1].map(q=>[x,cy+ry*Math.sqrt(1-(q*.8)**2)+.004,q*rz*.8]),.012,graphite);
  }

  // Extractable power cassette. End rings and copper rotor remain readable
  // when it rises through the open dorsal bay; heat-sink fins belong to it.
  const coreGroup=group(robot,[-.15,2.35,0]),rotor=group(coreGroup),fans=[],gears=[];
  bar(rotor,[-.72,0,0],[.72,0,0],.3,graphite);
  for(const x of [-.68,-.48,0,.48,.68])ring(rotor,[x,0,0],.315,.025,bronze);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bar(rotor,[-.55,Math.cos(a)*.31,Math.sin(a)*.31],[.55,Math.cos(a)*.31,Math.sin(a)*.31],.026,orange)}
  // A single pale timing tab breaks the rotor's 12-fold visual symmetry.
  mesh(new THREE.BoxGeometry(.27,.029,.068),pale,rotor,[.24,.335,0]);
  mesh(new THREE.BoxGeometry(.055,.036,.074),orange,rotor,[.37,.335,0]);
  for(const side of [-1,1]){
    bar(coreGroup,[-.8,-.25,side*.38],[.8,-.25,side*.38],.055,steel);
    const sink=group(coreGroup,[0,.1,side*.4]);
    for(let i=0;i<17;i++)mesh(new THREE.BoxGeometry(.018,.43,.2),graphite,sink,[-.56+i*.07,0,0]);
    bar(sink,[-.61,.225,0],[.61,.225,0],.027,steel);bar(sink,[-.61,-.225,0],[.61,-.225,0],.027,steel);
    tube(coreGroup,[[-.6,-.05,side*.32],[-.82,.05,side*.4],[-.85,.4,side*.25]],.04,orange);
    bolt(coreGroup,[-.75,-.2,side*.42],.035,[0,0,side]);bolt(coreGroup,[.75,-.2,side*.42],.035,[0,0,side]);
    for(const x of [-.66,.66]){
      const manifold=group(coreGroup,[x,.21,side*.43]);mesh(new THREE.BoxGeometry(.16,.13,.21),steel,manifold);
      for(const z of [-.065,.065]){bar(manifold,[0,0,z],[0,.13,z],.024,bronze);ring(manifold,[0,.115,z],.027,.006,graphite,[0,1,0]);}
    }
    tube(coreGroup,[[-.66,.34,side*.365],[-.5,.51,side*.38],[.3,.5,side*.4],[.66,.34,side*.365]],.024,bronze);
    tube(coreGroup,[[-.66,.34,side*.495],[-.5,.42,side*.54],[.42,.42,side*.54],[.66,.34,side*.495]],.026,rubber);
  }
  for(const x of [-.76,.76]){
    ring(coreGroup,[x,0,0],.34,.018,steel);
    for(let j=0;j<8;j++){const a=j*Math.PI/4;bar(coreGroup,[x,Math.cos(a)*.21,Math.sin(a)*.21],[x,Math.cos(a)*.31,Math.sin(a)*.31],.018,graphite)}
    bar(coreGroup,[x-.035,0,0],[x+.035,0,0],.16,steel);ring(coreGroup,[x+.04,0,0],.12,.009,bronze);
  }
  // Seven-blade fans rotate independently inside fixed end guards. The broad
  // orange blade is an angular index, not a moving housing or flickering light.
  for(const side of [-1,1]){
    const fan=group(coreGroup,[side*.815,0,0]);
    bar(fan,[-.018,0,0],[.018,0,0],.073,steel);
    for(let blade=0;blade<7;blade++){
      const a=blade*Math.PI*2/7,profile=new THREE.Shape();
      const pts=[[.076,a-.1],[.27,a+.13],[.265,a+.43],[.11,a+.5]].map(([r,t])=>[r*Math.cos(t),r*Math.sin(t)]);
      profile.moveTo(...pts[0]);for(const p of pts.slice(1))profile.lineTo(...p);profile.closePath();
      const paddle=mesh(new THREE.ExtrudeGeometry(profile,{depth:.012,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:1}),blade===0?orange:graphite,fan);
      paddle.rotation.y=Math.PI/2;
      const stripe=bar(fan,[.016,Math.sin(a+.29)*.17,-Math.cos(a+.29)*.17],[.016,Math.sin(a+.29)*.235,-Math.cos(a+.29)*.235],.005,steel);
    }
    fans.push({group:fan,axis:'x',ratio:side>0?1:-.8,base:0,bladeCount:7});
    const guardX=side*.865;
    ring(coreGroup,[guardX,0,0],.292,.014,steel);
    ring(coreGroup,[guardX+side*.012,0,0],.22,.006,graphite);
    ring(coreGroup,[guardX+side*.012,0,0],.145,.005,graphite);
    for(let spoke=0;spoke<3;spoke++){const a=spoke*Math.PI*2/3;bar(coreGroup,[guardX+side*.015,0,0],[guardX+side*.015,Math.cos(a)*.285,Math.sin(a)*.285],.009,steel)}
    bar(coreGroup,[guardX-side*.045,0,0],[guardX+side*.03,0,0],.045,graphite);
    ring(coreGroup,[guardX+side*.032,0,0],.033,.006,orange);
  }
  // Exposed 24:12 reduction pair on the accessible side of the power cassette.
  // module .015, pitch radii .18/.09, center distance .27. Only the toothed
  // wheels and their timing marks move; bearings, backplate and shafts stay put.
  mesh(new THREE.BoxGeometry(.59,.45,.035),graphite,coreGroup,[-.16,.1,.577]);
  for(const specification of [
    {center:[-.24,.1,.625],teeth:24,radius:.18,ratio:1,base:0},
    {center:[.03,.1,.625],teeth:12,radius:.09,ratio:-2,base:Math.PI/12},
  ]){
    const {center,teeth,radius,ratio,base}=specification,wheel=group(coreGroup,center);
    mesh(spurGearGeometry(teeth,radius,.024),teeth===24?steel:bronze,wheel);
    ring(wheel,[0,0,.027],radius*.78,.005,graphite,[0,0,1]);
    bar(wheel,[radius*.47,0,.029],[radius*.91,0,.029],teeth===24?.009:.006,orange);
    wheel.rotation.z=base;
    gears.push({group:wheel,axis:'z',ratio,base,teeth,pitchRadius:radius});
    bar(coreGroup,[center[0],center[1],.49],[center[0],center[1],.68],teeth===24?.029:.02,steel);
    ring(coreGroup,[center[0],center[1],.664],teeth===24?.042:.032,.008,graphite,[0,0,1]);
    bolt(coreGroup,[center[0],center[1],.685],.012,[0,0,1]);
  }
  for(const p of [[-.43,-.09,.601],[.105,-.09,.601],[-.43,.29,.601],[.105,.29,.601]])bolt(coreGroup,p,.014,[0,0,1]);
  label(coreGroup,'E1 // DRIVE CORE',[0,.05,.505],.7,.1);
  const core={group:coreGroup,base:coreGroup.position.clone(),rotor,fans,gears};

  // Neck support and broad elephant skull. The head group is separable as a
  // complete unit; individual head covers have their own local shell offsets.
  bar(robot,[1.0,2.55,0],[1.52,2.86,0],.28,graphite);bearing(robot,[1.35,2.75,0],.3);
  const neck=alongX(robot,[1.01,2.55,0],[1.52,2.86,0]);
  for(let i=0;i<7;i++)ring(neck,[.04+i*.075,0,0],.285-i*.004,.018,i===1||i===5?orange:steel);
  for(const side of [-1,1])tube(robot,[[1.01,2.45,side*.24],[1.17,2.44,side*.38],[1.42,2.67,side*.41],[1.6,2.85,side*.34]],.03,graphite);
  const head=group(robot,[1.45,2.85,0]);
  ellipsoid(head,[.15,0,0],[.57,.62,.45],graphite);
  const headStations=[[-.35,0,0,.42,.42],[-.15,.07,0,.65,.57],[.23,.05,0,.67,.57],[.62,-.06,0,.5,.43],[.84,-.22,0,.25,.28]];
  for(const side of [-1,1]){
    const cover=shell(mesh(loft(headStations,side>0?.03:Math.PI+.03,Math.PI-.06),pale,head),[.12,.35,side*.32],'head');
    tube(cover,headStations.map(([x,y,z,ry,rz])=>[x,y+ry+.006,side*.012]),.012,ceramic);
    for(const x of [-.1,.25,.55])bolt(cover,[x,.3,side*(x>.4?.4:.51)],.02,[0,0,side]);
    const cheekAngle=side>0?1.91:Math.PI*2-1.91;
    surfacePatch(cover,headStations,-.08,.53,cheekAngle,.47,graphite,.014);
    for(let i=0;i<8;i++)tube(cover,Array.from({length:7},(_,j)=>surfacePoint(headStations,-.025+i*.071,cheekAngle-.19+j*.063,.025)),.012,i===0||i===7?orange:steel);
    const browAngle=side>0?.55:Math.PI*2-.55;
    surfacePatch(cover,headStations,-.04,.52,browAngle,.16,graphite,.012);
    for(const x of [.05,.45])latch(cover,surfacePoint(headStations,x,browAngle,.022),[0,Math.cos(browAngle),Math.sin(browAngle)],.075);
    for(const x of [.13,.48])tube(cover,Array.from({length:19},(_,i)=>surfacePoint(headStations,x,(side>0?.1:Math.PI+.1)+(Math.PI-.2)*i/18,.005)),.007,graphite);
    const brow=shell(mesh(loft([[.2,.23,side*.47,.055,.09],[.4,.25,side*.52,.075,.12],[.66,.17,side*.41,.045,.075]],0,Math.PI*2,24),ivory,head),[.12,.28,side*.25],'head');
    tube(brow,[[.24,.21,side*.55],[.43,.23,side*.63],[.64,.15,side*.47]],.008,bronze);
    // Lens modules extract along socket-local +Y. Leave the dark bearing behind.
    const socket=group(head,[.43,.03,side*.5]);socket.quaternion.setFromUnitVectors(Y,v([.7,.08,side*.72]).normalize());
    mesh(new THREE.CylinderGeometry(.155,.18,.12,40),graphite,socket);
    ring(socket,[0,.063,0],.15,.012,bronze,[0,1,0]);ring(socket,[0,.042,0],.166,.008,rubber,[0,1,0]);
    const eye=group(socket,[0,.07,0]);mesh(new THREE.CylinderGeometry(.13,.14,.07,48),steel,eye);
    for(const y of [-.023,-.009,.005,.019])ring(eye,[0,y,0],.136,.004,graphite,[0,1,0]);
    const pupil=mesh(new THREE.CircleGeometry(.104,48),rubber,eye,[0,.071,0]);pupil.rotation.x=-Math.PI/2;
    ring(eye,[0,.073,0],.094,.009,bronze,[0,1,0]);ring(eye,[0,.077,0],.063,.006,steel,[0,1,0]);
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7,shape=new THREE.Shape();
      const pts=[[.035,a+.42],[.075,a+.5],[.092,a+.05],[.047,a-.05]].map(([r,t])=>[Math.cos(t)*r,Math.sin(t)*r]);
      shape.moveTo(...pts[0]);for(const p of pts.slice(1))shape.lineTo(...p);shape.closePath();
      const blade=mesh(new THREE.ShapeGeometry(shape),graphite,eye,[0,.079+i*.0002,0]);blade.rotation.x=-Math.PI/2;
    }
    const dome=mesh(new THREE.SphereGeometry(.119,48,24,0,Math.PI*2,0,Math.PI/2),optic,eye,[0,.075,0]);dome.scale.y=.35;
    ring(eye,[0,.075,0],.121,.007,ceramic,[0,1,0]);
    for(let i=0;i<24;i++){const a=i*Math.PI/12,r=.128;bar(eye,[Math.cos(a)*r,.041,Math.sin(a)*r],[Math.cos(a)*(r+.008),.041,Math.sin(a)*(r+.008)],.0025,graphite)}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const key=mesh(new THREE.BoxGeometry(.032,.014,.019),orange,eye,[Math.cos(a)*.135,.044,Math.sin(a)*.135]);key.rotation.y=-a;}
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bolt(socket,[Math.cos(a)*.16,.065,Math.sin(a)*.16],.009,[0,1,0]);}
    for(const x of [-.055,.055])bar(socket,[x,-.04,0],[x,.02,0],.011,bronze);
    eyes.push({group:eye,base:eye.position.clone(),axis:new THREE.Vector3(0,1,0)});
    // Broad fan ear on a true hinge, backed by a structural vein pattern.
    const pivot=group(head,[-.2,.1,side*.46]);
    bearing(pivot,[0,0,0],.12);
    const outline=new THREE.Shape();outline.moveTo(0,.45);outline.bezierCurveTo(.4,.95,.94,.68,1.02,.12);outline.bezierCurveTo(1.08,-.4,.65,-.95,.2,-.72);outline.quadraticCurveTo(-.08,-.48,0,.45);
    const earGeometry=new THREE.ExtrudeGeometry(outline,{depth:.045,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:3,curveSegments:24});
    const earBow=(x,y)=>.065*Math.sin(THREE.MathUtils.clamp(x,0,1)*Math.PI)*Math.cos(y*1.3);
    const earVertices=earGeometry.attributes.position,originalEarNormals=earGeometry.attributes.normal.array.slice();
    for(let i=0;i<earVertices.count;i++)earVertices.setZ(i,earVertices.getZ(i)+earBow(earVertices.getX(i),earVertices.getY(i)));
    earGeometry.computeVertexNormals();
    // Extruded caps are non-indexed. Recomputing their normals after bending
    // lights every triangulation wedge separately; the analytic surface normal
    // is continuous across those seams while the actual bevel keeps its edge.
    const earNormals=earGeometry.attributes.normal;
    for(let i=0;i<earVertices.count;i++){
      const nz=originalEarNormals[i*3+2];if(Math.abs(nz)<.999)continue;
      const x=earVertices.getX(i),y=earVertices.getY(i),u=THREE.MathUtils.clamp(x,0,1);
      const dx=x>0&&x<1?.065*Math.PI*Math.cos(u*Math.PI)*Math.cos(y*1.3):0;
      const dy=-.065*1.3*Math.sin(u*Math.PI)*Math.sin(y*1.3);
      const normal=new THREE.Vector3(-dx*nz,-dy*nz,nz).normalize();earNormals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    earNormals.needsUpdate=true;
    const ear=mesh(earGeometry,ivory,pivot);ear.rotation.y=-side*Math.PI/2;
    const earPanel=shell(ear,[-.06,.04,side*.25],'ear');
    const lines=[[[0,0,0],[.22,.3,.065],[.65,.55,.065]],[[.04,-.05,.065],[.45,.1,.065],[.91,.16,.065]],[[.05,-.08,.065],[.38,-.28,.065],[.66,-.63,.065]]];
    for(const faceZ of [-.022,.069]){
      for(const points of lines)tube(earPanel,points.map(p=>[p[0],p[1],faceZ+earBow(p[0],p[1])]),.014,graphite);
      const edge=outline.getPoints(64).map(p=>[p.x,p.y,faceZ+earBow(p.x,p.y)]);tube(earPanel,edge,.012,ceramic);
      for(const p of [[.24,.55],[.77,.2],[.45,-.62]])bolt(earPanel,[...p,faceZ+earBow(...p)],.012,[0,0,faceZ<0?-1:1]);
      const sign=faceZ<0?-1:1;
      const ventShape=new THREE.Shape();ventShape.moveTo(.26,-.48);ventShape.quadraticCurveTo(.53,-.67,.75,-.26);ventShape.lineTo(.8,.02);ventShape.lineTo(.64,.16);ventShape.lineTo(.38,-.04);ventShape.closePath();
      const ventGeo=new THREE.ShapeGeometry(ventShape,24),vp=ventGeo.attributes.position;
      for(let i=0;i<vp.count;i++)vp.setZ(i,faceZ+sign*.005+earBow(vp.getX(i),vp.getY(i)));ventGeo.computeVertexNormals();
      const ventMat=graphite.clone();ventMat.side=THREE.DoubleSide;mesh(ventGeo,ventMat,earPanel);
      for(let i=0;i<5;i++){
        const y=-.38+i*.095,x=.4+i*.027;
        tube(earPanel,[[x,y,faceZ+sign*.012+earBow(x,y)],[x+.15,y+.04,faceZ+sign*.012+earBow(x+.15,y+.04)],[x+.29,y+.1,faceZ+sign*.012+earBow(x+.29,y+.1)]],.012,i===0?orange:steel);
      }
      for(const p of [[.17,.28],[.27,-.58]])latch(earPanel,[...p,faceZ+earBow(...p)],[0,0,sign],.08);
    }
    ears.push({pivot,side});
    // Ivory tusk, tapered from a heavy ring mount to a rounded machined point.
    const tusk=group(head,[.57,-.46,side*.32]);
    ring(tusk,[0,0,0],.15,.025,steel,[1,-.2,side*.1]);ring(tusk,[.09,-.025,side*.015],.13,.014,bronze,[1,-.2,side*.1]);
    for(const x of [.035,.055,.075])ring(tusk,[x,-x*.25,side*x*.16],.145-x*.15,.004,graphite,[1,-.2,side*.1]);
    taperTube(tusk,[[0,0,0],[.3,-.15,side*.05],[.65,-.17,side*.08],[1.0,.03,side*.055]],.125,.012,pale);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;bolt(tusk,[.005,Math.cos(a)*.135,Math.sin(a)*.135],.016,[1,0,0])}
    tusks.push({group:tusk,base:tusk.position.clone(),delta:v([.35,-.1,side*.25])});
  }
  label(head,'E1',[.78,.1,0],.15,.075,[0,Math.PI/2,0]);

  // Eighteen nested vertebrae. Every child begins at its parent's distal pivot;
  // the renderer only sets rotations, keeping the trunk connected at all poses.
  const trunkRoot=group(head,[.85,-.1,0]);trunkRoot.rotation.z=.12;
  const trunkDetails={tendons:[],fingers:[],joints:[],guides:[],wristParts:[],tipRotor:null};
  // Study-mode pieces retain their own mesh batches and rest transforms. Axes
  // describe extraction in parent coordinates; spinAxis is local to the part.
  const trunkPart=(part,index,side,axis,spinAxis,kind)=>({group:part,index,side,
    base:part.position.clone(),baseQuaternion:part.quaternion.clone(),axis:v(axis).normalize(),spinAxis,kind});
  const fineRing=(parent,p,r,thickness,mat,axis=[0,1,0])=>{
    const object=mesh(new THREE.TorusGeometry(r,thickness,6,24),mat,parent,p);
    object.quaternion.setFromUnitVectors(Z,v(axis).normalize());return object;
  };
  let parent=trunkRoot;
  for(let i=0;i<18;i++){
    const segment=group(parent,i===0?[0,0,0]:[0,-.13,0]),r=.24-(.24-.085)*i/17;
    mesh(new THREE.CylinderGeometry(r*.77,r*.72,.125,32),graphite,segment,[0,-.065,0]);
    // A spherical knuckle and transverse pin make each actual articulation
    // legible, rather than leaving an unexplained gap between shell washers.
    mesh(new THREE.SphereGeometry(r*.48,18,12),graphite,segment);
    bar(segment,[0,0,-r*.91],[0,0,r*.91],r*.105,steel);
    for(const side of [-1,1]){
      const joint=group(segment,[0,0,side*r*.91]);
      bar(joint,[0,0,-.008],[0,0,.008],r*.18,graphite);
      fineRing(joint,[0,0,side*.011],r*.143,.005,bronze,[0,0,1]);
      bar(joint,[0,0,side*.012],[0,0,side*.016],r*.072,steel);
      mesh(new THREE.BoxGeometry(r*.19,.009,.009),orange,joint,[0,r*.11,side*.016]);
      trunkDetails.joints.push(trunkPart(joint,i,side,[0,0,side],'z','bearing'));
    }
    for(const y of [-.036,-.063,-.09])fineRing(segment,[0,y,0],r*.745,.005,steel);
    ring(segment,[0,-.012,0],r*.88,.011,steel,[0,1,0]);
    ring(segment,[0,-.112,0],r*.78,.009,bronze,[0,1,0]);
    if(i%3===0){
      ring(segment,[0,-.015,0],r*.68,.017,bronze,[0,1,0]);
      for(let j=0;j<16;j++){const a=j*Math.PI/8,tooth=mesh(new THREE.BoxGeometry(.018,.024,r*.16),graphite,segment,[Math.sin(a)*r*.75,-.014,Math.cos(a)*r*.75]);tooth.rotation.y=a;}
    }
    for(const side of [-1,1]){
      const trunkProfile=[[.017,0,0,r*.87,r*.87],[.034,0,0,r,r],[.094,0,0,r*.95,r*.95],[.118,0,0,r*.83,r*.83]],trunkAngle=side>0?Math.PI/2:Math.PI*1.5;
      const plate=mesh(loft(trunkProfile,side>0?.1:Math.PI+.1,Math.PI-.2,24),i%6===0?ceramic:ivory,segment);plate.rotation.z=-Math.PI/2;
      shell(plate,[.08,0,side*(.12+r*.3)],'trunk',{index:i,side});
      surfacePatch(plate,trunkProfile,.046,.091,trunkAngle,.8,graphite,.004);
      for(const a of [trunkAngle-.28,trunkAngle+.28])tube(plate,[surfacePoint(trunkProfile,.05,a,.008),surfacePoint(trunkProfile,.086,a,.008)],.004,steel);
      if(i%3===0)tube(plate,Array.from({length:13},(_,j)=>surfacePoint(trunkProfile,.027,(side>0?.28:Math.PI+.28)+(Math.PI-.56)*j/12,.005)),.007,orange);
      if(i%4===0)bolt(plate,[.06,0,side*r],.009,[0,0,side]);
      tube(segment,[[r*.67,0,side*r*.32],[r*.79,-.06,side*r*.34],[r*.63,-.13,side*r*.3]],.009,bronze);
      const guide=group(segment,[r*.77,-.055,side*r*.35]);guide.rotation.x=Math.PI/2;
      mesh(new THREE.CylinderGeometry(.018,.018,.026,16),graphite,guide);
      ring(guide,[0,.014,0],.018,.004,steel,[0,1,0]);
      // This off-centre timing tab makes pulley rotation visible in close-up.
      mesh(new THREE.BoxGeometry(.009,.003,.006),orange,guide,[.011,.018,0]);
      trunkDetails.guides.push(trunkPart(guide,i,side,[.8,0,side*.6],'y','tendon-guide'));
    }
    // A second tendon pair runs through protected inner guides. It is revealed
    // when the shell moves, rather than painted as a line on the exterior.
    for(const side of [-1,1])bar(segment,[-r*.57,0,side*r*.43],[-r*.54,-.13,side*r*.4],.009,graphite);
    trunkSegments.push(segment);parent=segment;
  }
  // Four tendons cross every real joint. Their end anchors belong to adjacent
  // vertebrae and the renderer updates the short spans after posing the chain.
  // Shell displacement therefore reveals continuous routes, not static lines.
  const tendonGeometry=new THREE.CylinderGeometry(.008,.008,1,8);
  for(let i=0;i<trunkSegments.length-1;i++){
    const segment=trunkSegments[i],next=trunkSegments[i+1],r=.24-(.24-.085)*i/17,nextR=.24-(.24-.085)*(i+1)/17;
    for(let route=0;route<4;route++){
      const angle=Math.PI/4+route*Math.PI/2;
      const from=group(segment,[Math.cos(angle)*r*.92,-.105,Math.sin(angle)*r*.92]);
      const to=group(next,[Math.cos(angle)*nextR*.91,-.025,Math.sin(angle)*nextR*.91]);
      for(const anchor of [from,to]){
        mesh(new THREE.CylinderGeometry(.015,.015,.027,12),steel,anchor);
        fineRing(anchor,[0,-.011,0],.015,.003,graphite);
      }
      const tendon=mesh(tendonGeometry,route%2===0?orange:graphite,segment);
      tendon.castShadow=false;
      trunkDetails.tendons.push({mesh:tendon,from,to});
    }
  }
  const trunkTip=group(parent,[0,-.13,0]);
  ellipsoid(trunkTip,[0,-.02,0],[.093,.058,.085],graphite);
  const wristCollar=group(trunkTip,[0,-.025,0]);
  fineRing(wristCollar,[0,0,0],.085,.008,steel);
  trunkDetails.wristParts.push(trunkPart(wristCollar,18,0,[0,-1,0],'y','collar'));
  const tipRotor=group(trunkTip,[0,-.016,0]);trunkDetails.tipRotor=tipRotor;
  trunkDetails.wristParts.push(trunkPart(tipRotor,18,0,[0,1,0],'y','encoder'));
  fineRing(tipRotor,[0,0,0],.093,.006,bronze);
  for(let i=0;i<10;i++){const a=i*Math.PI/5,tooth=mesh(new THREE.BoxGeometry(.014,.018,.012),i===0?orange:graphite,tipRotor,[Math.cos(a)*.093,0,Math.sin(a)*.093]);tooth.rotation.y=-a;}
  for(const side of [-1,1]){
    // Opposed, independently pivoting jaws. Positive side*openAngle about Z
    // spreads them; zero is the resting grasp. Pads stay on the inside face.
    const finger=group(trunkTip,[side*.065,-.055,0]);
    bar(finger,[0,0,-.027],[0,0,.027],.025,steel);
    for(const capSide of [-1,1]){
      const cap=group(finger,[0,0,capSide*.03]);
      fineRing(cap,[0,0,0],.02,.004,graphite,[0,0,1]);
      bar(cap,[0,0,-.002],[0,0,.002],.013,steel);
      mesh(new THREE.BoxGeometry(.017,.003,.003),orange,cap,[0,.009,capSide*.003]);
      trunkDetails.wristParts.push({...trunkPart(cap,18,capSide,[0,0,capSide],'z','hinge-cap'),fingerSide:side});
    }
    const path=[[0,0,0],[side*.027,-.045,0],[side*.018,-.095,0],[-side*.021,-.145,0]];
    taperTube(finger,path,.028,.012,ivory);
    tube(finger,path.map(p=>[p[0]+side*.012,p[1],.01]),.006,orange);
    ellipsoid(finger,[-side*.022,-.127,0],[.012,.03,.024],rubber);
    for(const y of [-.112,-.127,-.142])bar(finger,[-side*.026,y,-.018],[-side*.026,y,.018],.003,steel);
    trunkDetails.fingers.push({group:finger,side,axis:'z',base:0});
  }
  // Recessed optical/proximity apertures remain fixed in the wrist housing.
  for(const side of [-1,1]){
    const aperture=group(trunkTip,[0,-.063,side*.047]);
    mesh(new THREE.CylinderGeometry(.019,.019,.012,16),rubber,aperture);
    fineRing(aperture,[0,-.007,0],.019,.003,steel);
  }
  robot.updateMatrixWorld(true);
  for(const tendon of trunkDetails.tendons){
    const a=tendon.mesh.parent.worldToLocal(tendon.from.getWorldPosition(new THREE.Vector3()));
    const b=tendon.mesh.parent.worldToLocal(tendon.to.getWorldPosition(new THREE.Vector3()));
    const direction=b.clone().sub(a);tendon.mesh.position.copy(a).add(b).multiplyScalar(.5);
    tendon.mesh.scale.y=direction.length();tendon.mesh.quaternion.setFromUnitVectors(Y,direction.normalize());
  }

  // Four thick legs retain a fixed one-unit upper and lower link. Armour and
  // wiring travel with their link; each broad foot has a flush rubber sole.
  for(const design of LEG_DESIGNS){
    const {row,side,hip,kneeRest,footRest,upperLength,lowerLength}=design;
    bearing(robot,hip,.25);const knee=bearing(robot,kneeRest,.22);
    // Sealed rotary drives sit on the actual hip and knee axes. Cooling grooves,
    // a recessed encoder cap and one service connector replace decorative bolts.
    for(const [parent,p,r] of [[robot,[hip[0],hip[1],hip[2]+side*.235],.19],[knee,[0,0,side*.205],.16]]){
      const drive=group(parent,p);drive.quaternion.setFromUnitVectors(Y,v([0,0,side]));
      mesh(new THREE.CylinderGeometry(r,r,.13,48),graphite,drive);
      for(const y of [-.045,-.02,.005,.03])ring(drive,[0,y,0],r+.005,.006,steel,[0,1,0]);
      mesh(new THREE.CylinderGeometry(r*.82,r*.82,.018,48),bronze,drive,[0,.074,0]);
      mesh(new THREE.CylinderGeometry(r*.66,r*.66,.021,48),graphite,drive,[0,.085,0]);
      ring(drive,[0,.098,0],r*.49,.006,steel,[0,1,0]);
      bar(drive,[r*.4,-.04,0],[r+.065,-.04,0],.025,bronze);ring(drive,[r+.045,-.04,0],.029,.006,rubber);
      for(let j=0;j<3;j++){const a=j*Math.PI*2/3;bolt(drive,[Math.cos(a)*r*.71,.088,Math.sin(a)*r*.71],.009,[0,1,0]);}
    }
    const upper=alongX(robot,hip,kneeRest),lower=alongX(robot,kneeRest,footRest);
    for(const [segment,L,which] of [[upper,upperLength,0],[lower,lowerLength,1]]){
      bar(segment,[0,0,0],[L,0,0],which?.14:.17,graphite);
      for(const s of [-1,1])bar(segment,[.1,.08,s*.11],[L-.08,.05,s*.1],.032,steel);
      const profile=[[.1,0,0,.16,.19],[.25,0,0,which?.23:.28,which?.24:.28],[L*.7,.015,0,which?.22:.25,which?.23:.27],[L-.08,0,0,.13,.17]];
      for(const s of [-1,1]){
        const plate=shell(mesh(loft(profile,s>0?.035:Math.PI+.035,Math.PI-.07),which?ivory:pale,segment),[0,0,s*.35],'leg');
        for(const x of [.28,L*.65])bolt(plate,[x,.02,s*(which?.242:.282)],.014,[0,0,s]);
        const angle=s>0?Math.PI/2:Math.PI*1.5;
        for(const edge of [.11,L-.09])tube(plate,Array.from({length:17},(_,j)=>surfacePoint(profile,edge,(s>0?.05:Math.PI+.05)+(Math.PI-.1)*j/16)),.009,bronze);
        surfacePatch(plate,profile,.29,.75,angle,.78,graphite,.012);
        for(let j=0;j<8;j++)tube(plate,Array.from({length:7},(_,k)=>surfacePoint(profile,.325+j*.055,angle-.33+k*.11,.024)),.012,j===0||j===7?orange:steel);
        for(const x of [.19,.83])latch(plate,surfacePoint(profile,x,angle,.017),[0,Math.cos(angle),Math.sin(angle)],.075);
        tube(plate,Array.from({length:13},(_,j)=>surfacePoint(profile,.54,(s>0?.12:Math.PI+.12)+(Math.PI-.24)*j/12,.006)),.006,graphite);
        tube(segment,[[.08,-.12,s*.1],[L*.45,-.2,s*.13],[L-.06,-.1,s*.1]],.022,orange);
        for(const x of [.25,.72])ring(segment,[x,-.16,s*.12],.032,.008,steel);
      }
      ring(segment,[.13,0,0],which?.17:.2,.018,steel);
    }
    const foot=group(robot,footRest);bearing(foot,[0,.1,0],.15);
    const footShape=ellipsoid(foot,[0,.015,0],[.35,.18,.3],ivory);
    const sole=mesh(new THREE.CylinderGeometry(.32,.32,.06,48),rubber,foot,[0,-.17,0]);sole.scale.set(1.1,1,.94);
    for(const z of [-.16,0,.16]){
      const nailOutline=new THREE.Shape();nailOutline.moveTo(-.065,-.055);nailOutline.lineTo(.065,-.055);nailOutline.lineTo(.06,.025);nailOutline.quadraticCurveTo(0,.073,-.06,.025);nailOutline.closePath();
      const nail=mesh(new THREE.ExtrudeGeometry(nailOutline,{depth:.024,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2}),pale,foot,[.298,-.07,z]);nail.rotation.y=Math.PI/2;
      tube(foot,[[.301,-.115,z-.064],[.307,-.035,z-.052],[.307,-.005,z],[.307,-.035,z+.052],[.301,-.115,z+.064]],.006,bronze);
    }
    for(let n=0;n<4;n++)ring(foot,[0,-.151+n*.01,0],.32,.004,graphite,[0,1,0]).scale.set(1.1,1,.94);
    legs.push({row,side,hip:[...hip],kneeRest:[...kneeRest],footRest:[...footRest],upper,lower,foot,knee,upperLength,lowerLength});
  }

  // Flexible tail with a restrained cable bundle at its tip.
  const tailPoints=[[-1.68,2.45,0],[-1.93,2.15,0],[-2.08,1.63,0],[-2.02,1.22,0]];
  taperTube(robot,tailPoints,.055,.026,graphite);
  ring(robot,[-1.72,2.39,0],.07,.012,bronze,[.2,.8,0]);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;tube(robot,[[-2.02,1.26,0],[-2.01+Math.cos(a)*.045,1.1,Math.sin(a)*.045],[-2.0+Math.cos(a)*.07,.99,Math.sin(a)*.07]],.012,rubber)}

  batchRigidDetails(robot,[robot,head,trunkRoot,...trunkSegments,trunkTip,...ears.map(e=>e.pivot),...eyes.map(e=>e.group),...tusks.map(t=>t.group),coreGroup,rotor,
    ...fans.map(f=>f.group),...gears.map(g=>g.group),
    ...trunkDetails.tendons.map(t=>t.mesh),...trunkDetails.fingers.map(f=>f.group),
    ...trunkDetails.joints.map(p=>p.group),...trunkDetails.guides.map(p=>p.group),...trunkDetails.wristParts.map(p=>p.group),
    ...legs.flatMap(leg=>[leg.upper,leg.lower,leg.knee,leg.foot]),...shells.map(s=>s.object)]);
  return {robot,head,headBase:head.position.clone(),trunkRoot,trunkRootBase:trunkRoot.position.clone(),trunkSegments,trunkTip,
    ears,legs,shells,eyes,tusks,core,trunkDetails};
}
