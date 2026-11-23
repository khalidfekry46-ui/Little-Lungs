const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:3000,height:2000}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()!=='log')console.log('c:',m.text().slice(0,200))});
await p.goto('http://localhost:8790/'+(process.argv[2]||'station.html'));
await p.waitForFunction(()=>window.DONE,null,{timeout:300000});
await p.waitForTimeout(500);
await p.locator('#wrap').screenshot({path:process.argv[3]||'station.png',omitBackground:true});
await b.close()})()
