'use strict';
const assert=require('node:assert/strict');

// Intentional 1.36 interaction adapter: the old harness still performs its
// original held gesture, then explicitly confirms the provisional placement.
// Existing geometry/history/scale expectations remain the test's own checks.
async function confirmOrdinaryGrip(page,screen,report,label='legacy ordinary grip'){
 const stage=await page.evaluate(()=>window.linecraft.getOrdinaryGripState());
 assert.equal(stage.active,true,`${label}: held release must remain provisional`);
 assert.equal(stage.phase,'latched',`${label}: release must arm independent placement`);
 assert.ok(Number.isFinite(screen?.x)&&Number.isFinite(screen?.y));
 await page.mouse.click(screen.x,screen.y);
 assert.equal(await page.evaluate(()=>window.linecraft.getOrdinaryGripState().active),false,`${label}: confirming click must finish once`);
 if(report)(report.interactionAdapters??=[]).push({label,release:'provisional',confirmation:'independent-left-click',screen:{x:screen.x,y:screen.y}});
}
module.exports={confirmOrdinaryGrip};
