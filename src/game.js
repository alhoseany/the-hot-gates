export const TOWERS = {
 arrow: { name:'Archer tower', tag:'PRECISION', cost:65, damage:16, cooldown:.62, range:3.5, color:'#c58b49', description:'Fast single-target fire. A dependable opening defense.', icon:'➶' },
 cannon: { name:'Bombard', tag:'AREA DAMAGE', cost:110, damage:36, cooldown:1.9, range:3.6, splash:1.35, color:'#7a8990', description:'Explosive rounds punish tightly packed infantry.', icon:'✹' },
 frost: { name:'Greek fire', tag:'CONTROL', cost:90, damage:8, cooldown:.75, range:3.2, slow:.48, color:'#69a59d', description:'Alchemical fire slows enemies. Pair with a bombard.', icon:'♨' },
 banner: { name:'Rally standard', tag:'SUPPORT', cost:85, damage:0, cooldown:1, range:3.7, color:'#bd745c', description:'Nearby defenses deal 35% more damage. Does not attack.', icon:'⚑' }
};
export const LEVELS = [
 {name:'The Hot Gates',place:'Thermopylae',year:'480 BCE',subtitle:'Hold the mountain pass',biome:'mountain',gold:270,waves:8,modifier:1,mechanic:'Betrayal opens a second approach at wave 5. Prepare the southern flank.',objective:'Hold both approaches through eight waves.',paths:[ [[-9,-2],[-5,-2],[-5,2],[1,2],[1,-2],[7,-2],[9,-2]], [[-5,6],[-5,2],[1,2],[1,-2],[7,-2],[9,-2]] ],pads:[[-7,-.2],[-3,0],[-3,3.7],[0,0],[3,0],[4,-3.8],[6,-.2],[0,3.8],[-6,4.4],[7,-3.8]]},
 {name:'The Double Siege',place:'Alesia',year:'52 BCE',subtitle:'A war on two fronts',biome:'forest',gold:330,waves:9,modifier:1.12,mechanic:'Inner and outer forces attack simultaneously. Split your defenses between both roads.',objective:'Survive nine waves from two fronts.',paths:[ [[-9,-4],[-5,-4],[-5,0],[-1,0],[-1,4],[6,4],[9,1]], [[-9,4],[-5,4],[-5,0],[-1,0],[-1,-4],[6,-4],[9,1]] ],pads:[[-7,-2],[-7,2],[-3,-2],[-3,2],[1,-2],[1,2],[3,-5.6],[3,5.6],[6,-1],[6,1],[0,0]]},
 {name:'The Last Walls',place:'Constantinople',year:'1453 CE',subtitle:'Guard the city of emperors',biome:'city',gold:350,waves:10,modifier:1.22,mechanic:'Enemy artillery costs 15 gold after each wave. Armored Janissaries resist arrows; use bombards.',objective:'Protect the gate through ten waves of siege.',paths:[ [[-9,-4],[-5,-4],[-5,3],[0,3],[0,-3],[5,-3],[5,1],[9,1]] ],pads:[[-7,-2],[-3,-2],[-3,1],[2,1],[2,-4.8],[6.8,-1],[7,3],[0,5],[3,3],[-6,5]]},
 {name:'Fire on the Water',place:'Malta',year:'1565 CE',subtitle:'Hold until the fleet arrives',biome:'island',gold:350,waves:10,modifier:1.3,mechanic:'Corsair runners mix with heavy siege troops. Relief supplies bring 70 extra gold after waves 3 and 6.',objective:'Hold ten waves until the relief fleet arrives.',paths:[ [[-9,3],[-5,3],[-5,-2],[0,-2],[0,3],[5,3],[5,-2],[9,-2]], [[-9,-4],[-5,-4],[-5,-2],[0,-2],[0,3],[5,3],[5,-2],[9,-2]] ],pads:[[-7,0],[-3,0],[-3,-4],[2,0],[2,4.8],[6.8,1],[7,-4],[0,-4],[4,-.5],[-6,4.8]]},
 {name:'Before the Dawn',place:'Vienna',year:'1683 CE',subtitle:'The final bastion',biome:'autumn',gold:390,waves:12,modifier:1.42,mechanic:'Three approaches converge at the bastion. Endure twelve waves to bring in the Winged Hussars.',objective:'Defend all three approaches until dawn.',paths:[ [[-9,-4],[-4,-4],[-4,0],[2,0],[2,3],[7,3],[9,3]], [[-9,4],[-4,4],[-4,0],[2,0],[2,3],[7,3],[9,3]], [[1,-6],[1,-3],[5,-3],[5,0],[2,0],[2,3],[7,3],[9,3]] ],pads:[[-6,-2],[-6,2],[-2,-2],[-2,2],[0,1.8],[3.5,-1.7],[6.8,0],[5,4.8],[0,-4.6],[7,1.5],[-3,5.5]]}
];
export const ENEMIES = {
 infantry:{name:'Infantry',hp:48,speed:1.05,reward:9,armor:0,color:'#d38163'},
 runner:{name:'Runner',hp:32,speed:1.85,reward:10,armor:0,color:'#d3ae55'},
 swarm:{name:'Raider',hp:24,speed:1.35,reward:6,armor:0,color:'#ae8e68'},
 tank:{name:'Heavy guard',hp:145,speed:.72,reward:19,armor:.45,color:'#748b91'},
 healer:{name:'Field healer',hp:80,speed:.9,reward:16,armor:0,color:'#9fba91'},
 boss:{name:'Siege commander',hp:650,speed:.58,reward:90,armor:.2,color:'#a05b61'}
};
export function wavePlan(levelIndex,wave) {
 const l=LEVELS[levelIndex], result=[];
 for(let i=0;i<7+wave*2;i++) {
  let type='infantry';
  if(wave>=2&&i%4===0) type='runner';
  if(wave>=3&&i%3===0) type='swarm';
  if(wave>=4&&i%5===0) type='tank';
  if(wave>=6&&i%9===0) type='healer';
  result.push(type);
 }
 if(wave===l.waves||wave===Math.ceil(l.waves/2)) result.push('boss');
 return result;
}
export function pointOnPath(path,distance) {
 for(let i=1;i<path.length;i++) {const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=len)return {x:a[0]+(b[0]-a[0])*distance/len,z:a[1]+(b[1]-a[1])*distance/len,angle:Math.atan2(b[0]-a[0],b[1]-a[1])};distance-=len;}
 return null;
}
export class Game {
 constructor(index=0,onEvent=()=>{}) {this.index=index;this.level=LEVELS[index];this.onEvent=onEvent;this.gold=this.level.gold;this.lives=20;this.wave=0;this.enemies=[];this.towers=[];this.queue=[];this.active=false;this.status='ready';this.time=0;this.nextId=1;this.kills=0;this.spellCooldown=0;this.spawnClock=0;}
 emit(type,data={}) {this.onEvent({type,...data});}
 build(pad,type) {const t=TOWERS[type];if(!t||!this.level.pads[pad]||this.towers.some(x=>x.pad===pad)||this.gold<t.cost||['won','lost'].includes(this.status))return false;this.gold-=t.cost;const [x,z]=this.level.pads[pad];const tower={id:this.nextId++,pad,type,x,z,level:1,cooldown:0,spent:t.cost};this.towers.push(tower);this.emit('build',{tower});return tower;}
 upgrade(id) {const t=this.towers.find(t=>t.id===id);if(!t||t.level>=3||['won','lost'].includes(this.status))return false;const cost=this.upgradeCost(t);if(this.gold<cost)return false;this.gold-=cost;t.spent+=cost;t.level++;this.emit('upgrade',{tower:t});return true;}
 upgradeCost(t) {return Math.round(TOWERS[t.type].cost*(t.level===1?.85:1.3));}
 sell(id) {if(['won','lost'].includes(this.status))return false;const t=this.towers.find(t=>t.id===id);if(!t)return false;this.gold+=Math.floor(t.spent*.7);this.towers=this.towers.filter(x=>x!==t);this.emit('sell',{tower:t});return true;}
 startWave() {if(this.active||['won','lost'].includes(this.status))return false;this.wave++;this.active=true;this.status='playing';this.queue=wavePlan(this.index,this.wave);this.spawnClock=0;this.emit('wave');return true;}
 ability() {if(this.spellCooldown>0||!this.active)return false;this.spellCooldown=27;for(const e of this.enemies){e.hp-=95;e.slowTime=3;e.slowFactor=.35;}this.emit('ability');this.resolveDeaths();return true;}
 resolveDeaths() {for(const e of this.enemies.filter(e=>e.hp<=0)){this.gold+=e.reward;this.kills++;this.emit('death',{enemy:e});}this.enemies=this.enemies.filter(e=>e.hp>0);}
 tick(dt) {
  if(['won','lost'].includes(this.status))return;this.time+=dt;this.spellCooldown=Math.max(0,this.spellCooldown-dt);if(!this.active)return;
  this.spawnClock-=dt;
  while(this.queue.length&&this.spawnClock<=0){this.spawnClock+=.68;const type=this.queue.shift(),base=ENEMIES[type];const count=this.index===0&&this.wave<5?1:this.level.paths.length;const pathIndex=(this.nextId+this.wave)%count;const hp=base.hp*this.level.modifier*(1+(this.wave-1)*.17);const e={...base,id:this.nextId++,type,hp,maxHp:hp,pathIndex,distance:0,x:this.level.paths[pathIndex][0][0],z:this.level.paths[pathIndex][0][1],slowTime:0,slowFactor:1};this.enemies.push(e);this.emit('spawn',{enemy:e});}
  for(const e of this.enemies){e.slowTime=Math.max(0,e.slowTime-dt);e.distance+=e.speed*(e.slowTime>0?e.slowFactor:1)*dt;const p=pointOnPath(this.level.paths[e.pathIndex],e.distance);if(!p){e.escaped=true;this.lives=Math.max(0,this.lives-(e.type==='boss'?4:1));this.emit('escape',{enemy:e});}else Object.assign(e,p);if(e.type==='healer')for(const other of this.enemies)if(Math.hypot(other.x-e.x,other.z-e.z)<2)other.hp=Math.min(other.maxHp,other.hp+4*dt);}
  this.enemies=this.enemies.filter(e=>!e.escaped);
  for(const t of this.towers){const spec=TOWERS[t.type];if(!spec.damage)continue;t.cooldown-=dt;if(t.cooldown>0)continue;const range=spec.range+(t.level-1)*.35;const targets=this.enemies.filter(e=>Math.hypot(t.x-e.x,t.z-e.z)<=range);const target=targets.sort((a,b)=>b.distance-a.distance)[0];if(!target)continue;t.cooldown=spec.cooldown/(1+(t.level-1)*.13);const buff=this.towers.some(b=>b.type==='banner'&&Math.hypot(b.x-t.x,b.z-t.z)<=TOWERS.banner.range+(b.level-1)*.35)?1.35:1;const damage=spec.damage*(1+(t.level-1)*.65)*buff;for(const e of this.enemies){if(e!==target&&(!spec.splash||Math.hypot(e.x-target.x,e.z-target.z)>spec.splash))continue;e.hp-=damage*(1-(t.type==='arrow'?e.armor:0));if(spec.slow){e.slowTime=1.4;e.slowFactor=spec.slow;}}this.emit('shot',{tower:t,target,splash:spec.splash});}
  this.resolveDeaths();
  if(this.lives<=0){this.status='lost';this.active=false;this.emit('lost');return;}
  if(!this.queue.length&&!this.enemies.length){this.active=false;this.gold+=35+this.wave*6;if(this.index===2)this.gold=Math.max(0,this.gold-15);if(this.index===3&&[3,6].includes(this.wave))this.gold+=70;this.emit('clear');if(this.wave===this.level.waves){this.status='won';this.emit('won');}}
 }
}
