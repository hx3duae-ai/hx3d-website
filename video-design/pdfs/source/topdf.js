const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const n of ['problems','pla','buy']){await p.goto('file://'+process.cwd()+'/'+n+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
await p.pdf({path:n+'.pdf',format:'A4',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});}
await b.close();})();
