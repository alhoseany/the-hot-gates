import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {LEVELS} from '../src/game.js';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');await page.waitForFunction(()=>window.siegecraft);
 await mkdir('test-results',{recursive:true});
 for(let level=0;level<5;level++){
  if(level){await page.locator('#campaign-button').click();await page.locator(`[data-campaign="${level}"]`).click();}
  assert.equal(await page.evaluate(()=>siegecraft.state.index),level);
  for(const style of ['diorama','blueprint','neon','parchment']){
   await page.locator(`#style-switcher [data-style="${style}"]`).click();await page.waitForTimeout(160);
   assert.equal(await page.evaluate(()=>siegecraft.state.style),style);
   if(style==='diorama')await page.screenshot({path:`test-results/terrain-${level+1}.png`});
  }
  await page.locator('#style-switcher [data-style="diorama"]').click();
  // Every build site must remain usable with each landscape's new geometry.
  for(let pad=0;pad<LEVELS[level].pads.length;pad++){
   const p=await page.evaluate(i=>siegecraft.padScreen(i),pad);
   assert.ok(p.x>0&&p.x<1440&&p.y>0&&p.y<1000,`${LEVELS[level].place}: pad ${pad} in view`);
   await page.mouse.click(p.x,p.y);await page.waitForTimeout(40);
   assert.equal(await page.evaluate(()=>siegecraft.state.towers.length),1,`${LEVELS[level].place}: pad ${pad} is clickable`);
   await page.locator('#sell').click();
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: all five landscapes render in all four styles; every build site remains visible and clickable; no runtime errors.');
}finally{await browser.close();}
