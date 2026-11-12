import * as THREE from 'three';

// Compressed, history-inspired landscapes. Roads and build sites stay on a level
// tactical surface; relief, coastlines and architecture frame each battle.
export const LANDSCAPES = {
 mountain: {
  label:'Kallidromos foothills · Malian Gulf',
  description:'A rocky coastal pass, limestone ridges, olive scrub and hot springs.',
  palette:{grass:0xb1ad79,edge:0x8f8164,path:0xe0c99b,stone:0xbdb49c,leaf:0x71815b,water:0x558f9f,cliff:0x8b8b78,soil:0xa49872,roof:0xb17552,wood:0x766144,foam:0xb8d8cb,accent:0x895846},
 },
 forest: {
  label:'Mont Auxois · Burgundy',
  description:'A fortified hilltop above green valleys, broadleaf woods and Roman siege lines.',
  palette:{grass:0x81935b,edge:0x72664b,path:0xc9b087,stone:0xa69d7f,leaf:0x49694b,water:0x7caaa3,cliff:0x898367,soil:0x998056,roof:0xa78b58,wood:0x775839,foam:0xc5d2b1,accent:0x9e5142},
 },
 city: {
  label:'Theodosian walls · Golden Horn',
  description:'Layered stone walls, a dry moat, cypress gardens and a Byzantine waterfront.',
  palette:{grass:0xa1a27a,edge:0x8d7c60,path:0xd5c4a4,stone:0xd1c1a2,leaf:0x4c6c59,water:0x609ba5,cliff:0xa49373,soil:0x9f8a69,roof:0xa9634c,wood:0x7b5e46,foam:0xb7d4cc,accent:0xb5864b},
 },
 island: {
  label:'Grand Harbour · Malta',
  description:'Honey-colored limestone, angular bastions, dry scrub and turquoise harbor water.',
  palette:{grass:0xc2b280,edge:0xad966c,path:0xe5d3a3,stone:0xe2cc99,leaf:0x8c965c,water:0x378f9a,cliff:0xbea879,soil:0xcbbb8a,roof:0xc39b6b,wood:0x816345,foam:0xc2e0d1,accent:0xb44f42},
 },
 autumn: {
  label:'Vienna Woods · Danube plain',
  description:'Wooded hills, vineyard rows and river meadows outside a bastioned city.',
  palette:{grass:0x9ba16c,edge:0x817252,path:0xd2bc90,stone:0xd4c6a5,leaf:0x72834f,water:0x709b9c,cliff:0x9a9175,soil:0x9b895e,roof:0x9b624e,wood:0x785c41,foam:0xc4d6c5,accent:0xb88d49},
 },
};

export function sceneryClear(level,x,z,radius=.5) {
 if(level.pads.some(p=>Math.hypot(p[0]-x,p[1]-z)<radius+.78))return false;
 for(const path of level.paths)for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<radius+.66)return false;
 }
 return true;
}

class Landscape {
 constructor(world){this.w=world;this.level=world.game.level;this.group=new THREE.Group();this.group.name=`landscape-${this.level.biome}`;world.root.add(this.group);this.water=[];this.hills=[];}
 box(w,h,d,role,x,y,z,parent=this.group){return this.w.box(w,h,d,role,x,y,z,parent);}
 cylinder(a,b,h,n,role,x,y,z,parent=this.group){return this.w.cylinder(a,b,h,n,role,x,y,z,parent);}
 shape(geo,role,x,y,z,parent=this.group){return this.w.mesh(geo,this.w.material(role),x,y,z,parent);}
 clear(x,z,r=.5){return sceneryClear(this.level,x,z,r);}
 mark(obj,kind){obj.userData.landscapeFeature=kind;return obj;}
 rock(x,z,s=.5,y=0){const m=this.shape(new THREE.DodecahedronGeometry(s,0),'cliff',x,y+s*.23,z);m.scale.set(1,.65,.8);m.rotation.set(.1,x*.7,z*.2);return this.mark(m,'rock');}
 hill(x,z,sx,sy,sz,rocky=false){const m=this.shape(new THREE.IcosahedronGeometry(1,1),rocky?'cliff':'grass',x,-.15,z);m.scale.set(sx,sy,sz);m.rotation.y=x*.13;this.hills.push({x,z,sx,sy,sz,angle:m.rotation.y});return this.mark(m,rocky?'ridge':'hill');}
 surfaceHeight(x,z){let height=0;for(const h of this.hills){const dx=x-h.x,dz=z-h.z,c=Math.cos(h.angle),s=Math.sin(h.angle),u=(dx*c-dz*s)/h.sx,v=(dx*s+dz*c)/h.sz;const q=1-u*u-v*v;if(q>0)height=Math.max(height,h.sy*Math.sqrt(q)-.35);}return height;}
 tree(x,z,s=1,kind='oak',y=this.surfaceHeight(x,z)){
  const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);this.group.add(g);this.mark(g,kind);
  this.cylinder(.055,.11,.85,5,'wood',0,.42,0,g);
  if(kind==='cypress'){this.cylinder(.07,.34,1.75,7,'leaf',0,1.25,0,g);this.cylinder(0,.27,.8,7,'leaf',0,2.05,0,g);}
  else if(kind==='pine'){this.cylinder(0,.56,1.5,6,'leaf',0,1.15,0,g);this.cylinder(0,.4,1.1,6,'leaf',0,1.8,0,g);}
  else {for(const [dx,dy,dz,r]of [[0,1.2,0,.62],[-.34,1.05,.13,.42],[.35,1.15,-.12,.45]]){const crown=this.shape(new THREE.IcosahedronGeometry(r,1),'leaf',dx,dy,dz,g);if(kind==='olive')crown.scale.y=.62;}if(kind==='olive')g.scale.y=.8;}
  return g;
 }
 scrub(x,z,s=.35){const m=this.shape(new THREE.IcosahedronGeometry(s,0),'leaf',x,s*.35,z);m.scale.y=.5;this.mark(m,'scrub');}
 waterPatch(x,z,w,d){const m=this.box(w,.06,d,'water',x,-.77,z);m.castShadow=false;this.mark(m,'water');this.water.push(m);return m;}
 waves(x,z,w,d,count=14){for(let i=0;i<count;i++){const px=x+(this.w.random(i*13+3)-.5)*w,pz=z+(this.w.random(i*23+7)-.5)*d;const m=this.box(.25+this.w.random(i*15)*.65,.012,.025,'foam',px,-.725,pz);m.castShadow=false;this.mark(m,'wave');}}
 flag(x,z,y=1.4,role='accent',cross=false,parent=this.group){this.cylinder(.025,.035,y,5,'wood',x,y/2,z,parent);this.box(.6,.38,.035,role,x+.28,y-.2,z,parent);if(cross){this.box(.25,.055,.045,'foam',x+.28,y-.2,z+.02,parent);this.box(.055,.25,.045,'foam',x+.28,y-.2,z+.02,parent);}}
 cottage(x,z,s=1,thatch=false,y=0){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);this.group.add(g);this.box(.9,.65,.75,'stone',0,.32,0,g);const roof=this.cylinder(0,.74,.5,4,thatch?'soil':'roof',0,.87,0,g);roof.rotation.y=Math.PI/4;this.box(.18,.35,.025,'wood',0,.2,.39,g);this.mark(g,thatch?'roundhouse':'house');return g;}
 wallSegment(x,z,len,angle=0,height=1.2,wood=false){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;this.group.add(g);this.mark(g,wood?'palisade':'wall');
  if(wood){for(let a=-len/2;a<=len/2;a+=.22)this.cylinder(.055,.095,height,5,'wood',a,height/2,0,g);this.box(len,.1,.1,'wood',0,height*.4,.1,g);}
  else{this.box(len,height,.35,'stone',0,height/2,0,g);this.box(len,.09,.37,'roof',0,height*.36,0,g);this.box(len,.09,.37,'roof',0,height*.7,0,g);for(let a=-len/2+.15;a<len/2;a+=.48)this.box(.24,.25,.4,'stone',a,height+.12,0,g);}
  return g;
 }
 boat(x,z,s=1){const g=new THREE.Group();g.position.set(x,-.65,z);g.rotation.y=-.4;g.scale.setScalar(s);this.group.add(g);const hull=this.cylinder(.2,.37,1.9,4,'wood',0,.12,0,g);hull.rotation.x=Math.PI/2;this.cylinder(.025,.04,1.6,5,'wood',0,.95,0,g);const sail=this.shape(new THREE.ConeGeometry(.55,1.1,3),'foam',.12,1.2,0,g);sail.scale.z=.06;this.mark(g,'galley');}
 fort(){
  const biome=this.level.biome,[x,z]=this.level.paths[0].at(-1),g=new THREE.Group();g.position.set(x+.95,0,z);this.group.add(g);this.mark(g,'objective');
  if(biome==='mountain'){
   // A low field wall and bronze shields, rather than a medieval castle.
   this.box(.6,.65,2.5,'stone',0,.32,0,g);for(const dz of [-.8,0,.8]){const shield=this.cylinder(.25,.25,.08,12,'accent',-.36,.72,dz,g);shield.rotation.z=Math.PI/2;this.cylinder(.025,.025,1.5,5,'wood',.1,.8,dz,g);}this.flag(.15,0,1.9,'accent',false,g);
  }else if(biome==='forest'){
   for(const dz of [-1.05,1.05]){this.box(.8,1.1,.65,'wood',0,.55,dz,g);this.box(1,.15,.85,'soil',0,1.2,dz,g);const roof=this.cylinder(0,.7,.55,4,'roof',0,1.65,dz,g);roof.rotation.y=Math.PI/4;}
   this.box(.35,.9,1.5,'wood',.28,.45,0,g);this.flag(0,0,2,'accent',false,g);
  }else if(biome==='city'){
   this.box(.65,1.8,2.8,'stone',0,.9,0,g);for(const dz of [-1.25,1.25]){this.box(1,2.4,.85,'stone',0,1.2,dz,g);for(let k=-1;k<=1;k++)this.box(.2,.28,.9,'stone',k*.32,2.53,dz,g);for(const h of [.6,1.3,2])this.box(1.01,.1,.87,'roof',0,h,dz,g);}this.box(.02,1.3,.6,'wood',-.34,.65,0,g);this.flag(.1,0,2.6,'accent',true,g);
  }else{
   const fort=this.cylinder(1.15,1.4,1.6,biome==='island'?5:6,'stone',0,.8,0,g);fort.rotation.y=Math.PI/4;this.cylinder(1,1,.15,biome==='island'?5:6,'soil',0,1.65,0,g);this.flag(0,0,2.9,'accent',true,g);for(const dz of [-1,1]){const gun=this.cylinder(.09,.14,.7,8,'wood',-.8,1.65,dz*.6,g);gun.rotation.z=Math.PI/2;}
  }
 }
 scatter(kind,count,seed=1){for(let i=0;i<count;i++){
  const x=this.w.random(i*31+seed)*19.2-9.6,z=this.w.random(i*47+seed*3)*12.4-6.2,s=.55+this.w.random(i*11+seed)*.4;
  if(!this.clear(x,z,kind==='scrub'?.28:.62)||x>7.5)continue;
  if(kind==='rock')this.rock(x,z,s*.5);else if(kind==='scrub')this.scrub(x,z,s*.38);else this.tree(x,z,s,kind);
 }}
 thermopylae(){
  this.waterPatch(0,14,29,14);this.waves(0,13,27,11,30);
  for(let i=0;i<8;i++){const x=-10+i*2.8;this.hill(x,-7,1.9,2.3+this.w.random(i+3)*1.3,1.4,true);this.rock(x+.4,-5.8,.5);}
  for(let i=0;i<11;i++)this.rock(-10+i*1.9,6.8,.45);
  this.scatter('olive',48,7);this.scatter('scrub',62,11);this.scatter('rock',45,17);
  // Shallow spring tucked against the western foothills, clear of the pass.
  const spring=this.cylinder(.55,.65,.03,16,'water',-8,.025,-4.4);this.mark(spring,'hot-spring');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;this.rock(-8+Math.cos(a)*.7,-4.4+Math.sin(a)*.7,.16);}
 }
 alesia(){
  const plateau=this.cylinder(1,1.3,1.8,10,'grass',2,.65,-8.6);plateau.scale.set(4.6,1,2.1);this.mark(plateau,'oppidum-plateau');this.hill(-13,1,2.2,1.5,5.2);this.hill(6,8.7,5.5,1.3,1.7);
  // Mont Auxois with a small Gallic settlement on its flattened upper terrace.
  for(let i=0;i<4;i++)this.cottage(i*1.15+.1,-8.4,.8,true,1.55);
  for(const z of [-5.1,5.1])for(let x=-8;x<8;x+=.6)if(this.clear(x,z,.32)){this.wallSegment(x,z,.42,0,.7,true);if(this.clear(x,z+(z>0?-.55:.55),.17))this.cylinder(0,.1,.32,4,'wood',x,.16,z+(z>0?-.55:.55));}
  for(let i=0;i<5;i++)this.tree(-12.6,i*1.5-2,.9,'oak');
  this.scatter('oak',85,31);this.scatter('scrub',34,41);
  // The Oze/Ozerain valleys are suggested by a stream beyond the siege lines.
  this.waterPatch(1,10.6,25,1.15);this.waves(1,10.6,24,.9,18);
 }
 constantinople(){
  this.waterPatch(4,-14.8,31,14);this.waves(4,-13,29,9,26);
  // Two defensive belts with gates wherever the tactical routes cross them.
  for(const x of [7.8,9.05])for(let z=-5.8;z<=5.8;z+=.65)if(this.clear(x,z,.35))this.wallSegment(x,z,.6,Math.PI/2,x>8?1.7:1.05);
  for(let z=-5.5;z<=5.5;z+=1.25)if(this.clear(6,z,.38)){this.box(.55,.045,.9,'soil',6,.01,z);this.box(.2,.02,.9,'cliff',6,.035,z);}
  // Distant Byzantine blocks and a domed church; no post-conquest minarets.
  for(let i=0;i<9;i++){const x=-7+i*1.9;this.cottage(x,-6.3,.8+(i%3)*.1);}
  this.box(2.3,1.15,1.7,'stone',4,.58,-6.6);this.box(1.6,.5,1.4,'stone',4,1.4,-6.6);
  this.shape(new THREE.SphereGeometry(.82,12,6,0,Math.PI*2,0,Math.PI/2),'roof',4,1.65,-6.6);this.mark(this.group.children.at(-1),'byzantine-dome');
  for(const x of [-8.9,-5.6,-2.1,1.5,7])if(this.clear(x,-5.35,.45))this.tree(x,-5.35,.7,'cypress');
  this.scatter('cypress',27,61);this.scatter('scrub',24,65);this.boat(-4,-9.5,.8);
 }
 malta(){
  // A raised limestone peninsula, harbor arms, and sparse Mediterranean scrub.
  this.waterPatch(0,0,70,70);this.waves(0,0,32,25,65);
  for(const x of [-10.2,10.2])for(let z=-6;z<=6;z+=1.5)this.rock(x,z,.7);
  for(let i=0;i<12;i++)this.rock(-9+i*1.65,6.75,.6);
  // Harbor bastions outside the two approach roads.
  for(const [x,z]of [[-7.8,5.2],[7.5,-5.6]])if(this.clear(x,z,1.05)){
   const b=this.cylinder(1,1.3,1.2,5,'stone',x,.6,z);b.rotation.y=.6;this.mark(b,'limestone-bastion');this.flag(x,z,2.2,'accent',true);
  }
  this.wallSegment(1,-6.4,7,0,.75);this.wallSegment(8.7,3.2,3,Math.PI/2,.9);
  this.scatter('scrub',95,83);this.scatter('rock',38,93);this.scatter('olive',12,107);
  for(let i=0;i<5;i++){const x=-7.6+i*1.6;if(this.clear(x,-5.5,.55))this.cottage(x,-5.5,.75);}
  this.boat(-13,1,1.2);this.boat(12,-5,.95);this.boat(-5,10,1.05);
  this.box(2.6,.13,.5,'stone',-10.7,-.15,3.8);this.box(.45,.7,.45,'wood',-11.5,-.4,3.8);
 }
 vienna(){
  this.hill(-8.7,-9.1,4.2,2.2,2.7);this.hill(-1.5,-9.1,4.2,1.3,2.1);
  for(let i=0;i<14;i++){const x=-11+this.w.random(i+4)*10,z=-7.1-this.w.random(i+20)*1.7;this.tree(x,z,.7+this.w.random(i+50)*.5,i%4===0?'pine':'oak');}
  this.waterPatch(-14.5,0,5,24);this.waves(-14.5,0,4.5,22,23);
  // Vineyard rows on the gentle northern slope, outside the battlefield.
  for(let row=0;row<4;row++)for(let i=0;i<8;i++){const x=-2.5+i*.75,z=-6.65-row*.5;if(!this.clear(x,z,.2))continue;this.cylinder(.018,.025,.65,4,'wood',x,.32,z);this.box(.5,.2,.2,'leaf',x,.45,z);this.mark(this.group.children.at(-1),'vineyard');}
  this.scatter('oak',60,131);this.scatter('scrub',40,149);
  for(let z=-5;z<6;z+=.9)if(this.clear(8.9,z,.5)){this.wallSegment(8.9,z,.82,Math.PI/2,1.2);}
  for(let i=0;i<5;i++)this.cottage(10.5,-5+i*1.3,.8);
  this.box(.85,2.2,.85,'stone',10.7,1.1,-5.8);this.cylinder(0,.65,1.8,4,'roof',10.7,3.1,-5.8).rotation.y=Math.PI/4;
 }
 build(){({mountain:()=>this.thermopylae(),forest:()=>this.alesia(),city:()=>this.constantinople(),island:()=>this.malta(),autumn:()=>this.vienna()})[this.level.biome]();this.fort();return this.group;}
}
export function buildLandscape(world){return new Landscape(world).build();}
