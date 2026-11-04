import sys,glob,os
from PIL import Image
import numpy as np
from scipy import ndimage
fs=sorted(glob.glob('raw/*.png'))
for f in fs:
    a=np.asarray(Image.open(f).convert('RGB')).astype(np.int16)
    white=(a.min(2)>228)&((a.max(2)-a.min(2))<18)
    lab,_=ndimage.label(white)
    b=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])).tolist())-{0}
    sz=ndimage.sum(white,lab,range(1,lab.max()+1)); b|={i+1 for i,v in enumerate(sz) if v>1500}
    fg=~np.isin(lab,list(b))
    fg=ndimage.binary_opening(fg,iterations=2)
    l2,k=ndimage.label(fg)
    if k>1:
        s=ndimage.sum(fg,l2,range(1,k+1)); fg=np.isin(l2,[i+1 for i,v in enumerate(s) if v>s.max()*0.03])
    al=ndimage.gaussian_filter(fg.astype(np.float32),1.0)
    rgba=np.dstack([a.astype(np.uint8),(al*255).astype(np.uint8)])
    Image.fromarray(rgba).resize((360,640),Image.LANCZOS).save('key/'+os.path.basename(f))
