import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://localhost:5174/');await page.waitForFunction(()=>window.siegecraft);await page.waitForTimeout(600);
 assert.equal(await page.locator('[data-level]').count(),5);
 assert.ok(await page.evaluate(()=>{const r=document.querySelector('#battlefield').getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight&&document.documentElement.scrollHeight===innerHeight;}),'3D canvas fills the entire window without page scrolling');
 if(await page.evaluate(()=>document.fullscreenEnabled)){await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.keyboard.press('f');await page.waitForFunction(()=>!document.fullscreenElement);}assert.equal(await page.locator('#style-switcher [data-style]').count(),4);
 for(const style of ['diorama','blueprint','neon','parchment']){await page.locator(`#style-switcher [data-style=${style}]`).click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>siegecraft.state.style),style);}
 await page.locator('#style-switcher [data-style=diorama]').click();
 const p=await page.evaluate(()=>siegecraft.padScreen(3));await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>siegecraft.state.towers.length),1);assert.equal(await page.evaluate(()=>siegecraft.state.gold),205);
 await page.locator('#upgrade').click();assert.equal(await page.evaluate(()=>siegecraft.state.towers[0].level),2);
 await page.locator('#sell').click();assert.equal(await page.evaluate(()=>siegecraft.state.towers.length),0);
 await page.locator('[data-tower=cannon]').click();const p2=await page.evaluate(()=>siegecraft.padScreen(3));await page.mouse.click(p2.x,p2.y);assert.equal(await page.evaluate(()=>siegecraft.state.towers[0].type),'cannon');
 await page.locator('#start-wave').click();await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>siegecraft.state.wave),1);assert.ok(await page.evaluate(()=>siegecraft.state.enemies)>0);
 await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>siegecraft.state.paused),true);await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>siegecraft.state.paused),false);
 await page.locator('#ability').click();await page.locator('#speed').click();assert.equal(await page.evaluate(()=>siegecraft.state.speed),2);
 await page.locator('#campaign-button').click();await page.locator('[data-campaign="1"]').click();await page.locator('#confirm-level').click();assert.equal(await page.evaluate(()=>siegecraft.state.index),1);
 for(let i=2;i<5;i++){await page.locator('#campaign-button').click();await page.locator(`[data-campaign="${i}"]`).click();assert.equal(await page.evaluate(()=>siegecraft.state.index),i);}
 await page.locator('#campaign-button').click();await page.locator('[data-campaign="0"]').click();
 await page.locator('#help-button').click();assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);await page.locator('#close-modal').click();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const pm=await page.evaluate(()=>siegecraft.padScreen(1));await page.mouse.click(pm.x,pm.y);assert.equal(await page.evaluate(()=>siegecraft.state.towers.length),1);await page.locator('#close-selection').click();assert.equal(await page.locator('#selection-panel').isVisible(),false);await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight===innerHeight));await page.locator('#campaign-button').click();await page.locator('#close-modal').click();await page.screenshot({path:'test-results/landscape.png'});
 assert.deepEqual(errors,[]);console.log('PASS: edge-to-edge 3D canvas, fullscreen enter/exit, portrait/landscape layout, four styles, five levels, raycast building, upgrade/sell, wave spawn, pause, ability, speed, dialogs, mobile layout and placement; no runtime errors.');
} finally{await browser.close();}
