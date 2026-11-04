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
    if i not in cache: cache[i]=Image.open(f'../poses2/normhq/q{i:03d}.png').convert('RGBA')
    return cache[i]
from PIL import ImageDraw,ImageFilter
SH=Image.new('RGBA',(640,680),(0,0,0,0));ImageDraw.Draw(SH).ellipse((190,618,450,662),fill=(0,0,0,70));SH=SH.filter(ImageFilter.GaussianBlur(10))
os.makedirs(out,exist_ok=True);W,H=640,640;stable=None;cur=None;chg=0;si=0
for f in range(int(tot*FPS)+1):
    t=f/FPS
    while si<len(sched) and t>=sched[si][0]:
        if sched[si][1]!=cur: cur=sched[si][1];chg=f
        si+=1
    age=f-chg;im=img(cur)
    jx=2.5*math.sin(t*2.1+cur%7);jy=2.5*math.sin(t*2.7+cur%5)
    sc=1+0.035*(1-age/TR) if age<TR else 1.0
    if sc!=1.0:
        sw,sh=int(W*sc),int(H*sc);im=im.resize((sw,sh),Image.LANCZOS);ox=int((W-sw)/2);oy=int(H-sh)
    else: ox=oy=0
    Cv=Image.new('RGBA',(W,H+40),(0,0,0,0));Cv.alpha_composite(SH,(0,0));Cv.alpha_composite(im,(int(jx)+ox,int(20+jy)+oy))
    Cv.save(f'{out}/f{f:05d}.png')
    if age>=TR-1: stable=Cv
print(len(sched),'changes')
