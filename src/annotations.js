import * as THREE from 'three';
/** Leaders follow the actual articulated objects, including in exploded views. */
export function createAnnotations(svg,model){
  const items=[
    {id:'E1.04',name:'OPTICAL CARRIER',node:model.eyes[1].group,side:1,y:.24},
    {id:'E1.01',name:'POWER CASSETTE',node:model.core.group,side:-1,y:.25},
    {id:'E1.07',name:'ROTARY KNEE DRIVE',node:model.legs[0].knee,side:-1,y:.49},
    {id:'E1.09',name:'TENDON CHAIN',node:model.trunkSegments[12],side:1,y:.52},
    {id:'E1.10',name:'FINGERTIP GRIP',node:model.trunkTip,side:1,y:.72,detail:true},
    {id:'E1.11',name:'CROSS-PIN JOINT',node:model.trunkSegments[5],side:-1,y:.28,detail:true},
    {id:'E1.12',name:'BEARING CARRIER',node:model.trunkDetails.joints[0].group,side:-1,y:.27,studyOnly:true},
    {id:'E1.13',name:'TENDON PULLEY',node:model.trunkDetails.guides[0].group,side:1,y:.38,studyOnly:true},
    {id:'E1.14',name:'ENCODER COLLAR',node:model.trunkDetails.tipRotor,side:-1,y:.28,studyOnly:true},
    {id:'E1.15',name:'REMOVABLE ARMOR',node:model.trunkSegments[0],side:1,y:.38,studyOnly:true},
  ];
  svg.innerHTML=items.map(()=>'<g><path fill="none" stroke="#6b9697" stroke-width=".7"/><circle r="2.4" fill="#e26751"/><rect width="121" height="29" rx="1" fill="#f1f5ff" fill-opacity=".9"/><text font-family="IBM Plex Mono,monospace" font-size="7" letter-spacing=".6" fill="#57787c"/><text font-family="IBM Plex Mono,monospace" font-size="8" fill="#203e47"/></g>').join('');
  items.forEach((item,i)=>{item.el=svg.children[i];item.el.children[3].textContent=item.id;item.el.children[4].textContent=item.name;});
  const point=new THREE.Vector3();
  return function update(camera,enabled,phase,study=null){
    const {width:w,height:h}=svg.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.display=enabled?'block':'none';if(!enabled)return;
    for(const item of items){
      if(study){const index=Math.round(study.focusIndex);if(item.id==='E1.12')item.node=model.trunkDetails.joints.find(p=>p.index===index&&p.side<0).group;if(item.id==='E1.13')item.node=model.trunkDetails.guides.find(p=>p.index===index&&p.side>0).group;if(item.id==='E1.15')item.node=model.shells.find(p=>p.kind==='trunk'&&p.index===index&&p.side>0).object;if(item.id==='E1.09')item.node=model.trunkSegments[index];}
      else if(item.id==='E1.09')item.node=model.trunkSegments[12];
      item.node.getWorldPosition(point);point.project(camera);
      const x=(point.x*.5+.5)*w,y=(-point.y*.5+.5)*h;
      const relevant=study?(w<500?item.id==='E1.09':(['tip','detail'].includes(study.stage)?['E1.14','E1.10']:study.stage==='armor'?['E1.15','E1.09']:['E1.12','E1.13']).includes(item.id)):!item.studyOnly&&(phase==='TRUNK'?(w>=500?['E1.09','E1.10','E1.11'].includes(item.id):item.id==='E1.09'):!item.detail&&(w>=500||(phase==='OPTICS'?item.id==='E1.04':phase==='CORE'?item.id==='E1.01':item.id==='E1.09')));
      const visible=relevant&&point.z>-1&&point.z<1&&x>8&&x<w-8&&y>30&&y<h-80;
      item.el.setAttribute('visibility',visible?'visible':'hidden');if(!visible)continue;
      const lx=item.side<0?10:w-131,ly=h*item.y,edge=item.side<0?lx+121:lx;
      const [path,dot,box,number,label]=item.el.children;
      path.setAttribute('d',`M${x.toFixed(1)} ${y.toFixed(1)} L${(edge+(item.side<0?12:-12)).toFixed(1)} ${(ly+14).toFixed(1)} H${edge}`);
      dot.setAttribute('cx',x);dot.setAttribute('cy',y);box.setAttribute('x',lx);box.setAttribute('y',ly);
      number.setAttribute('x',lx+6);number.setAttribute('y',ly+10);label.setAttribute('x',lx+6);label.setAttribute('y',ly+22);
    }
  };
}
