const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--disable-background-networking','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND']});
 try {
 const context=await browser.newContext(); const requests=[],errors=[];
 await context.route('**/*',r=>{if(r.request().url().startsWith('file:'))return r.continue();requests.push(r.request().url());return r.abort();});
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text}}));
 const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../email-builder.html')).href);
 await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.querySelector('[data-bid]'));
 // При запуске открыта панель «О конструкторе», работа с блоками — на своей вкладке
 await page.locator('#t-blocks').click();
 const fixtures=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=1600;c.height=600;const x=c.getContext('2d');const d=x.createImageData(c.width,c.height);let n=123456;
   for(let i=0;i<d.data.length;i+=4){n=(Math.imul(n,1664525)+1013904223)>>>0;d.data[i]=n&255;d.data[i+1]=(n>>>8)&255;d.data[i+2]=(n>>>16)&255;d.data[i+3]=i%16?255:80;}
   x.putImageData(d,0,0);return {png:c.toDataURL('image/png'),jpeg:c.toDataURL('image/jpeg',.95)};
 });
 const project={settings:{subject:'Quality test'},blocks:[{type:'image',alt:'Quality fixture',img:null,width:536}]};
 await page.locator('#openJson').setInputFiles({name:'quality.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('.toggle').first().click();
 for(const [ext,src] of Object.entries(fixtures)){
   const buffer=Buffer.from(src.split(',')[1],'base64');assert.ok(buffer.length>400*1024);
   await page.locator('.card input[type=file]').setInputFiles({name:`original.${ext}`,mimeType:`image/${ext}`,buffer});
   await page.waitForFunction(()=>document.querySelector('.thumb img')?.naturalWidth===1600);
   const state=await page.evaluate(()=>{document.querySelector('#copyJson').click();return JSON.parse(window.copied);});
   assert.equal(state.blocks[0].img.src,src);assert.equal(state.blocks[0].img.w,1600);assert.equal(state.blocks[0].img.h,600);
   await page.locator('#copyCode').click();
   const html=await page.evaluate(()=>window.copied);assert.ok(html.includes(src));assert.ok(html.includes('width="536"'));
 }
 // Import the embedded attachment from an EML without re-encoding its bytes.
 const eml=['MIME-Version: 1.0','Content-Type: multipart/related; boundary="quality"','','--quality','Content-Type: text/html; charset=utf-8','','<p>Received test</p><img src="cid:test-image" width="536" height="201">','--quality','Content-Type: image/png','Content-ID: <test-image>','Content-Transfer-Encoding: base64','',fixtures.png.split(',')[1],'--quality--'].join('\r\n');
 await page.locator('#t-import').click();
 await page.locator('#importFile').setInputFiles({name:'received.eml',mimeType:'message/rfc822',buffer:Buffer.from(eml)});
 await page.locator('[data-relayout]').click();
 await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.body?.textContent.includes('Received test'));
 const state=await page.evaluate(()=>{document.querySelector('#copyJson').click();return JSON.parse(window.copied);});
 assert.ok(state.blocks.some(b=>b.img?.src===fixtures.png));
 // A 1x image should produce a density warning, not be silently enlarged/re-encoded.
 project.blocks[0].img={src:fixtures.png,w:1600,h:600};project.blocks[0].width=600;project.settings.width=800;
 project.blocks[0].img.w=800;project.blocks[0].img.h=300;
 await page.locator('#openJson').setInputFiles({name:'density.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('[data-view=checks]').click();
 await page.waitForFunction(()=>document.querySelector('#checks').textContent.includes('плотностью пикселей'));
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 console.log('PASS: large PNG/JPEG bytes and native dimensions unchanged through upload/export; embedded CID PNG unchanged after EML import; high-density warning shown; no network or JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
