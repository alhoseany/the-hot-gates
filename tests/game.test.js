import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,LEVELS,TOWERS,pointOnPath,wavePlan} from '../src/game.js';
const finish=g=>{for(let i=0;i<40000&&g.active;i++)g.tick(1/30);assert.equal(g.active,false,'Wave must end');};
test('path interpolation handles corners and exits',()=>{assert.deepEqual(pointOnPath([[0,0],[2,0],[2,3]],3),{x:2,z:1,angle:0});assert.equal(pointOnPath([[0,0],[2,0]],3),null);});
test('building, upgrades, occupancy, and sell refunds conserve money',()=>{const g=new Game();const t=g.build(0,'arrow');assert.equal(g.gold,205);assert.equal(g.build(0,'cannon'),false);const cost=g.upgradeCost(t);assert.ok(g.upgrade(t.id));assert.equal(g.gold,205-cost);assert.equal(t.level,2);const refund=Math.floor(t.spent*.7);assert.ok(g.sell(t.id));assert.equal(g.gold,205-cost+refund);assert.equal(g.towers.length,0);});
test('insufficient funds and invalid tower placement are rejected',()=>{const g=new Game();assert.equal(g.build(-1,'arrow'),false);assert.equal(g.build(0,'missing'),false);g.gold=0;assert.equal(g.build(0,'cannon'),false);assert.equal(g.towers.length,0);});
test('every level can lose and cannot start another wave after defeat',()=>{for(let i=0;i<5;i++){const g=new Game(i);while(g.status!=='lost'){assert.ok(g.startWave());finish(g);}assert.equal(g.lives,0);assert.equal(g.startWave(),false);assert.equal(g.build(0,'arrow'),false);}});
test('rally has a cooldown and damages enemies',()=>{const g=new Game();g.startWave();g.tick(.1);assert.ok(g.enemies.length);assert.ok(g.ability());assert.equal(g.enemies.length,0);assert.ok(g.spellCooldown>0);assert.equal(g.ability(),false);});
test('flanking path stays closed until Thermopylae wave 5',()=>{const g=new Game();g.startWave();for(let i=0;i<70;i++)g.tick(.1);assert.ok(g.enemies.every(e=>e.pathIndex===0));g.active=false;g.enemies=[];g.wave=4;g.startWave();for(let i=0;i<100;i++)g.tick(.1);assert.ok(g.enemies.some(e=>e.pathIndex===1));});
test('all five campaigns are winnable with normal spending and mixed defenses',()=>{
 for(let index=0;index<LEVELS.length;index++){
 const g=new Game(index);const order=[3,1,4,2,6,0,7,8,5,9,10].filter(i=>i<g.level.pads.length);
 const types=['cannon','frost','arrow','cannon','arrow','cannon','arrow','banner','frost','arrow','cannon'];
 function invest(){for(let k=0;k<order.length;k++){if(!g.towers.some(t=>t.pad===order[k])&&g.gold>=TOWERS[types[k]].cost)g.build(order[k],types[k]);}for(const t of g.towers)while(t.level<3&&g.gold>=g.upgradeCost(t))g.upgrade(t.id);}
 while(g.status!=='won'&&g.status!=='lost'){invest();g.startWave();for(let n=0;n<40000&&g.active;n++){g.tick(1/30);if(g.enemies.length>6||g.enemies.some(e=>e.type==='boss'))g.ability();if(n%150===0)invest();}}
 assert.equal(g.status,'won',`${g.level.place}: lost on wave ${g.wave}, kills ${g.kills}`);
 }
});
test('each campaign has a boss finale and increasing wave pressure',()=>{for(let i=0;i<5;i++){assert.ok(wavePlan(i,LEVELS[i].waves).includes('boss'));assert.ok(wavePlan(i,1).length<wavePlan(i,4).length);}});
