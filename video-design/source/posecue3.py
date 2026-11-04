import json,math,sys,os
from PIL import Image
tot,out,cuef=float(sys.argv[1]),sys.argv[2],sys.argv[3]
FPS=30;TR=5;HOLD=60
cues=sorted(json.load(open(cuef)))
n=int(tot*FPS)+1;pose=[];last=None;chg=-999;ci=0;pending=None
for f in range(n):
    t=f/FPS
    while ci<len(cues) and t>=cues[ci][0]: pending=cues[ci][1];ci+=1
    if pending is not None and pending!=last and (last is None or f-chg>=HOLD):
        last=pending;chg=f
    pose.append((last,chg))
cache={}
def img(i):
    if i not in cache:
        p=f'../poses/norm/p{i:02d}.png' if isinstance(i,int) else f'../poses4/norm/q{int(i[1:]):03d}.png'
        cache[i]=Image.open(p).convert('RGBA')
    return cache[i]
os.makedirs(out,exist_ok=True);W,H=640,640;prev=None;stable=None
for f,(p,chg) in enumerate(pose):
    t=f/FPS;age=f-chg;im=img(p)
    jx=2.5*math.sin(t*2.1+hash(str(p))%7);jy=2.5*math.sin(t*2.7+hash(str(p))%5)
    Cv=Image.new('RGBA',(W,H+40),(0,0,0,0));Cv.alpha_composite(im,(int(jx),int(20+jy)))
    if age<TR and stable is not None: Cv=Image.blend(stable,Cv,(age+1)/TR)
    Cv.save(f'{out}/f{f:05d}.png')
    if age>=TR-1: stable=Cv
print('poses',len(set(p for p,_ in pose)))
