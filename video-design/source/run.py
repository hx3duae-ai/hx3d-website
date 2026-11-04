import cv2,numpy as np,time,sys
U='/root/.claude/uploads/50f26e69-eec5-5827-9119-8996a328f953/'
sr=cv2.dnn_superres.DnnSuperResImpl_create();sr.readModel('EDSR_x4.pb');sr.setModel('edsr',4)
for name,fn in (('s0','dbc4ddc5-image.jpg'),('s1','510666e8-image.jpg'),('s5','aaf8eaeb-image.webp')):
    im=cv2.imread(U+fn) if not fn.endswith('webp') else cv2.cvtColor(np.asarray(__import__('PIL.Image',fromlist=['Image']).open(U+fn).convert('RGB')),cv2.COLOR_RGB2BGR)
    H,W=im.shape[:2];T=320;O=16;out=np.zeros((H*4,W*4,3),np.uint8);t0=time.time()
    for y in range(0,H,T):
        for x in range(0,W,T):
            y0,x0=max(0,y-O),max(0,x-O);y1,x1=min(H,y+T+O),min(W,x+T+O)
            up=sr.upsample(im[y0:y1,x0:x1])
            oy,ox=(y-y0)*4,(x-x0)*4;h,w=(min(H,y+T)-y)*4,(min(W,x+T)-x)*4
            out[y*4:y*4+h,x*4:x*4+w]=up[oy:oy+h,ox:ox+w]
    cv2.imwrite(f'{name}_x4.png',out);print(name,out.shape,round(time.time()-t0),flush=True)
print('ALLDONE',flush=True)
