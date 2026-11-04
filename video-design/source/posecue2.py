import json,math,sys,os,random
from PIL import Image
envf,tot,out,cuef=sys.argv[1],float(sys.argv[2]),sys.argv[3],sys.argv[4]
FPS=30;TR=5
segs=json.load(open(cuef))   # [[start,end,[ids...]],...] video seconds
sched=[]
for st,en,ids in segs:
    d=en-st;k=max(1,round(d/2.25)) if len(ids)>1 else 1
    for j in range(k): sched.append((st+j*d/k, ids[j%len(ids)]))
sched.sort()
n=int(tot*FPS)+1;pose=[];last=None;chg=-99
for f in range(n):
    t=f/FPS;p=sched[0][1]
    for ct,cp in sched:
        if t>=ct-0.05:p=cp
    if p!=last and f-chg<60 and last is not None: p=last   # hold min 60 frames
    if p!=last: chg=f;last=p
    pose.append((p,chg))
cache={}
def img(i):
    if i not in cache: cache[i]=Image.open(f'../poses2/normall/q{i:03d}.png').convert('RGBA')
    return cache[i]
os.makedirs(out,exist_ok=True);W,H=640,640;previm=None
for f,(p,chg) in enumerate(pose):
    t=f/FPS;age=f-chg;im=img(p)
    jx=2.5*math.sin(t*2.1+p)*1.0;jy=2.5*math.sin(t*2.7+p*0.7)
    sc=1+0.04*math.sin(min(1,age/TR)*math.pi) if age<TR else 1.0
    sw,sh=int(W*sc),int(H*sc)
    fr=im if sc==1.0 else im.resize((sw,sh),Image.BILINEAR)
    Cv=Image.new('RGBA',(W,H+40),(0,0,0,0));Cv.alpha_composite(fr,(int((W-sw)/2+jx),int(H-sh+20+jy)))
    if age<TR and previm is not None: Cv=Image.blend(previm,Cv,(age+1)/TR)
    if age==0: base_prev=previm
    Cv.save(f'{out}/f{f:05d}.png')
    if age>=TR-1 or previm is None: previm=Cv
print(len(sched),'scheduled', len(set(p for p,_ in pose)),'poses used')
