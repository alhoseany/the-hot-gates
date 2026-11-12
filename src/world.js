import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TOWERS } from './game.js';
import { LANDSCAPES, buildLandscape } from './landscape.js';
const THEMES={
 diorama:{bg:0xe8eddf,grass:0x8eaa70,edge:0x786a50,path:0xd4c395,stone:0xd0c9af,leaf:0x50764d,water:0x8dbfc0,ink:0x506747},
 blueprint:{bg:0x102e48,grass:0x194563,edge:0x102e48,path:0x316789,stone:0x729db5,leaf:0x44728a,water:0x174363,ink:0x8bdbe3},
 neon:{bg:0x17162d,grass:0x282741,edge:0x352d4c,path:0x60476e,stone:0x8e73a5,leaf:0x49726b,water:0x244e62,ink:0x54eed2},
 parchment:{bg:0xe4d3ac,grass:0xc5b385,edge:0x968061,path:0xede0bb,stone:0xb8a17d,leaf:0x8c8862,water:0xb3c1ad,ink:0x78613f}
};
export class World {
 constructor(canvas,onPad) {
  this.canvas=canvas;this.onPad=onPad;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.1,150);this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.maxPolarAngle=Math.PI*.44;this.controls.minPolarAngle=.35;this.controls.minDistance=16;this.controls.maxDistance=43;this.controls.enableDamping=true;this.controls.dampingFactor=.08;
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.materials=[];this.enemyMeshes=new Map();this.towerMeshes=new Map();this.effects=[];this.style='diorama';this.game=null;
  this.scene.add(new THREE.HemisphereLight(0xfff6df,0x536044,2.5));this.sun=new THREE.DirectionalLight(0xfff4d9,3);this.sun.position.set(-8,18,8);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-16,right:16,top:14,bottom:-14});this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.001;this.scene.add(this.sun);
  this.root=new THREE.Group();this.scene.add(this.root);this.resetCamera();
  let down;canvas.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects(this.padMeshes,false);if(hits.length)this.onPad(hits[0].object.userData.pad);});
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);this.resize();
 }
 resetCamera(){this.camera.position.set(15,21,24);this.controls.target.set(0,0,0);this.controls.update();}
 resize(){const w=this.canvas.parentElement.clientWidth,h=this.canvas.parentElement.clientHeight;this.camera.aspect=w/h;this.camera.zoom=Math.min(1.06,this.camera.aspect*.8);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 roleColor(role){
  const base=LANDSCAPES[this.game?.level.biome]?.palette[role]??THEMES.diorama[role]??0xaab095;
  if(this.style==='diorama')return base;
  if(THEMES[this.style][role]!==undefined)return THEMES[this.style][role];
  return new THREE.Color(base).lerp(new THREE.Color(this.style==='blueprint'?0x5086a5:this.style==='neon'?0x76558d:0xc5a779),.65);
 }
 material(role,color){const m=new THREE.MeshStandardMaterial({color:color??this.roleColor(role),roughness:.9,flatShading:true});m.userData={role,original:color};this.materials.push(m);return m;}
 mesh(geo,mat,x,y,z,parent=this.root){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(w,h,d,role,x,y,z,parent,color){return this.mesh(new THREE.BoxGeometry(w,h,d),this.material(role,color),x,y,z,parent);}
 cylinder(r1,r2,h,n,role,x,y,z,parent,color){return this.mesh(new THREE.CylinderGeometry(r1,r2,h,n),this.material(role,color),x,y,z,parent);}
 load(game){
  this.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.materials=[];this.root.clear();this.enemyMeshes.clear();this.towerMeshes.clear();this.effects=[];this.padMeshes=[];this.game=game;this.selectedPad=null;
  this.box(21,1.2,14,'edge',0,-.9,0);this.box(20.7,.28,13.7,'grass',0,-.18,0);
  // Inset terrain tiles make the landscape read like a hand-built tabletop.
  for(let x=-10;x<=10;x+=1)for(let z=-6;z<=6;z+=1){if(this.nearPath(x,z,1)||game.level.pads.some(p=>Math.hypot(p[0]-x,p[1]-z)<1))continue;const v=this.random(x*54+z*19);if(v>.74)this.box(.94,.025,.94,'grass',x,-.025,z);}
  game.level.paths.forEach((path,pi)=>{for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);const road=this.box(.95,.055,len+.88,'path',(a[0]+b[0])/2,.005,(a[1]+b[1])/2);road.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);}
   this.cylinder(.36,.4,.08,6,'ink',path[0][0],.08,path[0][1]);
   const marker=this.box(.11,1.1,.11,'stone',path[0][0],.55,path[0][1]-.65);this.box(.48,.27,.04,'stone',marker.position.x+.18,1,marker.position.z,undefined,0xb36b4e);
  });
  game.level.pads.forEach(([x,z],i)=>{this.cylinder(.63,.74,.14,8,'stone',x,.04,z);const pad=this.cylinder(.52,.52,.035,32,'grass',x,.13,z);pad.userData.pad=i;this.padMeshes.push(pad);this.box(.32,.025,.055,'ink',x,.155,z);this.box(.055,.025,.32,'ink',x,.155,z);});
  this.landscape=buildLandscape(this);
  this.rangeMesh=this.mesh(new THREE.RingGeometry(1,1.025,96),new THREE.MeshBasicMaterial({color:0x4e7752,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}),0,.19,0);this.rangeMesh.rotation.x=-Math.PI/2;this.rangeMesh.visible=false;this.setStyle(this.style);this.resetCamera();
 }
 random(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
 nearPath(x,z,r){return this.game.level.paths.some(p=>p.slice(1).some((b,i)=>{const a=p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<r;}));}
 select(pad,type,level=1){this.selectedPad=pad;if(pad===null){this.rangeMesh.visible=false;return;}const [x,z]=this.game.level.pads[pad];this.rangeMesh.position.set(x,.19,z);const range=TOWERS[type].range+(level-1)*.35;this.rangeMesh.scale.setScalar(range);this.rangeMesh.visible=true;}
 makeTower(t){const g=new THREE.Group();g.position.set(t.x,0,t.z);this.root.add(g);const spec=TOWERS[t.type];this.cylinder(.44,.52,.32,8,'stone',0,.24,0,g);this.cylinder(.29,.4,.9,8,'stone',0,.83,0,g);const head=new THREE.Group();head.position.y=1.36;g.add(head);if(t.type==='arrow'){this.box(.9,.14,.8,'edge',0,0,0,head);this.cylinder(0,.55,.6,4,'leaf',0,.4,0,head,spec.color).rotation.y=Math.PI/4;this.box(.08,.12,.8,'edge',0,.15,.35,head);}else if(t.type==='cannon'){this.cylinder(.45,.45,.3,8,'edge',0,0,0,head);const barrel=this.cylinder(.14,.2,.8,8,'edge',0,.22,.35,head);barrel.rotation.x=Math.PI/2.6;}else if(t.type==='frost'){this.cylinder(.38,.27,.28,8,'edge',0,0,0,head);const fire=this.mesh(new THREE.OctahedronGeometry(.32),this.material(null,spec.color),0,.4,0,head);fire.scale.y=1.65;}else {this.box(.06,1.2,.06,'edge',0,.4,0,head);this.box(.58,.5,.045,'leaf',.27,.72,0,head,spec.color);}for(let i=1;i<t.level;i++)this.cylinder(.1,.1,.08,6,'ink',-.16+(i-1)*.3,1.95,0,g);this.towerMeshes.set(t.id,{g,head,level:t.level});}
 makeEnemy(e){const g=new THREE.Group();this.root.add(g);const s=e.type==='boss'?1.55:e.type==='tank'?1.25:e.type==='swarm'?.7:.9;g.scale.setScalar(s);this.cylinder(.15,.21,.45,5,'leaf',0,.39,0,g,e.color);this.mesh(new THREE.IcosahedronGeometry(.16,0),this.material('stone'),0,.73,0,g);this.box(.07,.3,.1,'edge',-.1,.1,0,g);this.box(.07,.3,.1,'edge',.1,.1,0,g);if(['tank','boss'].includes(e.type))this.box(.35,.4,.08,'stone',0,.4,.2,g);if(e.type==='boss'){this.cylinder(.21,.18,.12,5,'ink',0,.9,0,g);this.box(.05,.9,.05,'edge',.35,.6,0,g);}const bar=this.box(.55,.055,.04,'edge',0,1.15,0,g);const fill=this.box(.53,.06,.045,'ink',0,1.15,.005,g);this.enemyMeshes.set(e.id,{g,bar,fill});}
 event(event){if(event.type==='shot'){const {tower:t,target:e}=event;const a=new THREE.Vector3(t.x,1.6,t.z),b=new THREE.Vector3(e.x,.5,e.z);const geo=new THREE.BufferGeometry().setFromPoints([a,b]);const mat=new THREE.LineBasicMaterial({color:t.type==='frost'?0x63d3b6:t.type==='cannon'?0xf7b85a:0xffe3a1,transparent:true});const line=new THREE.Line(geo,mat);this.root.add(line);this.effects.push({obj:line,life:.19,max:.19});const tm=this.towerMeshes.get(t.id);if(tm)tm.head.rotation.y=Math.atan2(e.x-t.x,e.z-t.z);if(event.splash){const ring=this.mesh(new THREE.RingGeometry(.1,1.3,32),new THREE.MeshBasicMaterial({color:0xe3ab62,transparent:true,opacity:.45,side:THREE.DoubleSide}),e.x,.2,e.z);ring.rotation.x=-Math.PI/2;this.effects.push({obj:ring,life:.3,max:.3});}}if(event.type==='ability'){for(const e of this.game.enemies){const m=this.mesh(new THREE.CylinderGeometry(.12,.5,4,6),new THREE.MeshBasicMaterial({color:0xffdc86,transparent:true,opacity:.7}),e.x,2,e.z);this.effects.push({obj:m,life:.55,max:.55});}}}
 disposeGroup(g){g.traverse(o=>{o.geometry?.dispose();if(o.material){const idx=this.materials.indexOf(o.material);if(idx>=0)this.materials.splice(idx,1);o.material.dispose();}});this.root.remove(g);}
 setStyle(style){this.style=style;const theme=THEMES[style];this.scene.background=new THREE.Color(theme.bg);this.scene.fog=new THREE.Fog(theme.bg,42,90);for(const m of this.materials){const color=m.userData.role?this.roleColor(m.userData.role):m.userData.original;if(color!==undefined)m.color.set(color);m.wireframe=style==='blueprint';m.emissive.set(style==='neon'?(m.userData.role==='ink'?0x22bfa0:0x160d29):0);m.emissiveIntensity=style==='neon'?.5:0;}this.sun.intensity=style==='neon'?1.4:3;this.sun.color.set(style==='parchment'?0xffdc9c:style==='neon'?0xafa5ff:0xfff4d9);this.renderer.shadowMap.enabled=style!=='blueprint';if(this.rangeMesh)this.rangeMesh.material.color.set(theme.ink);}
 render(dt,time){if(!this.game)return;for(const t of this.game.towers){const old=this.towerMeshes.get(t.id);if(old&&old.level!==t.level){this.disposeGroup(old.g);this.towerMeshes.delete(t.id);}if(!this.towerMeshes.has(t.id)){this.makeTower(t);this.setStyle(this.style);}}
 for(const [id,m]of this.towerMeshes)if(!this.game.towers.some(t=>t.id===id)){this.disposeGroup(m.g);this.towerMeshes.delete(id);}
 for(const e of this.game.enemies){if(!this.enemyMeshes.has(e.id)){this.makeEnemy(e);this.setStyle(this.style);}const m=this.enemyMeshes.get(e.id);m.g.position.set(e.x,Math.sin(time*10+e.id)*.035,e.z);m.g.rotation.y=e.angle||0;m.fill.scale.x=Math.max(.001,e.hp/e.maxHp);m.fill.position.x=-(1-e.hp/e.maxHp)*.265;}
 for(const [id,m]of this.enemyMeshes)if(!this.game.enemies.some(e=>e.id===id)){this.disposeGroup(m.g);this.enemyMeshes.delete(id);}
 for(const effect of this.effects){effect.life-=dt;effect.obj.material.opacity=Math.max(0,effect.life/effect.max);if(effect.life<=0)this.disposeGroup(effect.obj);}this.effects=this.effects.filter(e=>e.life>0);this.controls.update();this.renderer.render(this.scene,this.camera);}
}
