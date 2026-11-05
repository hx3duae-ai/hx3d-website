const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const T=43,F=30,N=T*F;const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+__dirname+'/scene.html');await p.evaluate(()=>window.ready);
const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-profile:v','main','-level','4.1','-r','30','-g','30','-crf','19','-pix_fmt','yuv420p','video.mp4'],{stdio:['pipe','inherit','inherit']});
for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/F);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%150==0)console.log(i);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();})();
