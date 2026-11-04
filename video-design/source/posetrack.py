import re,json,math,sys,os
from PIL import Image
import numpy as np
html,envf,tot,out=sys.argv[1],sys.argv[2],float(sys.argv[3]),sys.argv[4]
FPS=30
s=open(html,encoding='utf-8').read();s=s[:s.index('<div id="cap">')]
parts=re.split(r'(?=<div class="scene")',s)[1:]
scenes=[];hl=[]
for p in parts:
    tag=p[:p.index('>')]
    k=float((re.search(r'data-k="([\d.]+)"',tag) or [0,1])[1]);st=float(re.search(r'data-start="([\d.]+)"',tag)[1])
    scenes.append(st);hl+=[st+float(v)*k for v in re.findall(r'data-hl="([\d.]+)"',p)]
hl=sorted(set(hl));cta=scenes[-1];outro=scenes[-2]
env=json.loads(open(envf).read().split('=',1)[1].rstrip(';'))
WAVE=['q231',9,'q207'];TALK=[1,26,'q220',17,24,18,25,27,19];POINT=[3,'q211',28,'q228',29,'q245'];CHAP=[40,'q208',6];REST=0;CELEB=['q252','q223','q247','q251','q235']
n=int(tot*FPS)+1;pose=[]
ti=0;last=None;hold=0
for f in range(n):
    t=f/FPS;e=env[min(f,len(env)-1)];win=env[max(0,f-8):f+9]
    if t<1.6: p=WAVE[0]
    elif t>=cta+0.35:
        p=42 if t<cta+3.4 else (11 if t<cta+5.4 else 'q252')
    elif any(h-0.35<=t<=h+1.1 for h in hl):
        i=[j for j,h in enumerate(hl) if h-0.35<=t<=h+1.1][0];p=POINT[i%len(POINT)]
    elif any(sc+0.2<=t<=sc+1.4 for sc in scenes[1:-2]):
        p=CHAP[[j for j,sc in enumerate(scenes[1:-2]) if sc+0.2<=t<=sc+1.4][0]%2]
    elif t>=outro and t<cta: p=CELEB[int((t-outro)/1.4)%len(CELEB)]
    elif max(win)<0.12: p=REST
    else:
        if last not in TALK or hold<=0:
            p=TALK[ti%len(TALK)];ti+=1;hold=int(FPS*(1.5+0.6*((ti*7)%3)))
        else: p=last
    if p!=last: chg=f
    hold-=1;pose.append((p,chg));last=p
os.makedirs(out,exist_ok=True)
cache={}
def img(i):
    if i not in cache: cache[i]=Image.open(f'../poses2/norm/q{int(i[1:]):03d}.png' if isinstance(i,str) else f'../poses/norm/p{i:02d}.png').convert('RGBA')
    return cache[i]
W,H=640,640
prev=None
for f,(p,chg) in enumerate(pose):
    t=f/FPS;e=env[min(f,len(env)-1)];age=(f-chg)/FPS
    im=img(p)
    # pop on change
    q=min(1,age/0.22);sc=1+0.08*math.sin(q*math.pi)*(1-q*0.3) if age<0.22 else 1.0
    sq=1+0.025*e*math.sin(t*9)              # talk squash
    bob=-abs(math.sin(t*4.2))*10*e+math.sin(t*1.5)*4
    rot=math.sin(t*1.2)*1.5
    sw,sh=int(W*sc*(1+0.01*(sq-1)*-1)),int(H*sc*sq)
    fr=im.resize((sw,sh),Image.BILINEAR).rotate(rot,resample=Image.BILINEAR,center=(sw/2,sh*0.97))
    C=Image.new('RGBA',(W,H+40),(0,0,0,0));C.alpha_composite(fr,(int((W-sw)/2),int(H-sh+20+bob)))
    if age<0.1 and prev is not None:
        C=Image.blend(prev,C,age/0.1)
    C.save(f'{out}/f{f:05d}.png');prev=C
from collections import Counter;print(Counter(p for p,_ in pose).most_common(12), len(hl),'hl')
