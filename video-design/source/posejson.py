import json,math,sys,os
from PIL import Image
tot,out,tf=float(sys.argv[1]),sys.argv[2],sys.argv[3]
FPS=30;STEP=1.0;TR=5
segs=json.load(open(tf))
sched=[]
for s in segs:
    fr=[int(x.split()[0]) for x in s['frames']];t=s['start'];k=0
    while t<s['end']-0.3: sched.append((t,fr[k%len(fr)]));t+=STEP;k+=1
sched.sort()
cache={}
def img(i):
    if i not in cache: cache[i]=Image.open(f'../poses2/normall/q{i:03d}.png').convert('RGBA')
    return cache[i]
os.makedirs(out,exist_ok=True);W,H=640,640;stable=None;cur=None;chg=0;si=0
for f in range(int(tot*FPS)+1):
    t=f/FPS
    while si<len(sched) and t>=sched[si][0]:
        if sched[si][1]!=cur: cur=sched[si][1];chg=f
        si+=1
    age=f-chg;im=img(cur)
    jx=2.5*math.sin(t*2.1+cur%7);jy=2.5*math.sin(t*2.7+cur%5)
    Cv=Image.new('RGBA',(W,H+40),(0,0,0,0));Cv.alpha_composite(im,(int(jx),int(20+jy)))
    if age<TR and stable is not None: Cv=Image.blend(stable,Cv,(age+1)/TR)
    Cv.save(f'{out}/f{f:05d}.png')
    if age>=TR-1: stable=Cv
print(len(sched),'changes')
