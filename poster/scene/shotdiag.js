const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1960,height:2000},deviceScaleFactor:2});
await p.goto('http://localhost:8790/diagrams.html');await p.waitForTimeout(500);
await p.locator('#arch').screenshot({path:'../figures/fig_system_architecture.png'});
await p.locator('#flow').screenshot({path:'../figures/fig_decision_flow.png'});
await b.close()})()
