import json,math,sys,os
from PIL import Image
envf,tot,out,cuef=sys.argv[1],float(sys.argv[2]),sys.argv[3],sys.argv[4]
FPS=30;OFF=0.5
cues=json.load(open(cuef))  # [[narr_time or 'v'+video_time, pose], ...]
C=[]
for t,p in cues:
    vt=float(t[1:]) if isinstance(t,str) else t+OFF
    C.append((vt-0.15,p))
C.sort()
env=json.loads(open(envf).read().split('=',1)[1].rstrip(';'))
n=int(tot*FPS)+1;pose=[];last=None;chg=0
for f in range(n):
    t=f/FPS;p=C[0][1]
    for ct,cp in C:
        if t>=ct:p=cp
    if p!=last:chg=f;last=p
    pose.append((p,chg))
cache={}
def img(i):
    if i not in cache:
        if isinstance(i,int): pth=f'../poses/norm/p{i:02d}.png'
        elif i[0]=='q': pth=f'../poses2/norm/q{int(i[1:]):03d}.png'
        else: pth=f'../poses4/norm/q{int(i[1:]):03d}.png'
        cache[i]=Image.open(pth).convert('RGBA')
    return cache[i]
os.makedirs(out,exist_ok=True);W,H=640,640;prev=None
for f,(p,chg) in enumerate(pose):
    t=f/FPS;e=env[min(f,len(env)-1)];age=(f-chg)/FPS;im=img(p)
    sc=1+0.08*math.sin(min(1,age/0.22)*math.pi) if age<0.22 else 1.0
    sq=1+0.025*e*math.sin(t*9);bob=-abs(math.sin(t*4.2))*10*e+math.sin(t*1.5)*4;rot=math.sin(t*1.2)*1.5
    sw,sh=int(W*sc),int(H*sc*sq)
    fr=im.resize((sw,sh),Image.BILINEAR).rotate(rot,resample=Image.BILINEAR,center=(sw/2,sh*0.97))
    Cv=Image.new('RGBA',(W,H+40),(0,0,0,0));Cv.alpha_composite(fr,(int((W-sw)/2),int(H-sh+20+bob)))
    if age<0.1 and prev is not None: Cv=Image.blend(prev,Cv,age/0.1)
    Cv.save(f'{out}/f{f:05d}.png');prev=Cv
print(len(C),'cues')
