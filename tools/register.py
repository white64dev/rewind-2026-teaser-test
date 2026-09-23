import numpy as np, cv2, json, os
from PIL import Image
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=str(ROOT/'raw')          # Figma exports (not committed; see README)
meta={'d01_img59':(674,234),'d02_img4':(1693,623),'d03_paper':(79,439),'d04_note':(155,536),'d05_newspaper_l':(44,205),
'd06_badge':(1068,462),'d07_img10':(1231,429.6),'d08_img54':(1150,243),'d09_group32':(542,257),'d10_img42':(856,176),
'd11_photocard':(1040,684),'d12_photo':(624,672),'d13_img9':(578,504),'d14_puzzle':(467,721),'d15_newspaper_r':(1054,539),
'd16_note':(58,551),'d17_note':(40,530),'d18_note':(131,567),'d19_photo':(528,592),'d20_metrocard':(601,652),'d21_folder':(1351,251),
'd22_scissor':(540,329),'d23_stapler':(523,391),'d24_pencil':(1,582),'d25_ruler':(-82,602),'d26_manual':(1196,539),'d27_coffee':(991,515),
'd28_typewriter':(341,327),'d29_tw_copy':(759,347),'d32_lamp':(-160,177)}
ref=cv2.cvtColor(np.array(Image.open(R+'/ref_desk.png').convert('RGB')),cv2.COLOR_RGB2GRAY).astype(np.float32)
P=300
refp=cv2.copyMakeBorder(ref,P,P,P,P,cv2.BORDER_CONSTANT,value=0)
out={}
for k,(mx,my) in meta.items():
    im=np.array(Image.open(f'{R}/{k}.png').convert('RGBA')).astype(np.float32)
    h2,w2=im.shape[:2]; w,h=w2/2,h2/2
    sm=cv2.resize(im,(round(w),round(h)),interpolation=cv2.INTER_AREA)
    g=cv2.cvtColor(sm[...,:3],cv2.COLOR_RGB2GRAY)
    m=(sm[...,3]>242).astype(np.float32)
    # search window
    S=70
    x0=int(mx)-S+P; y0=int(my)-S+P
    win=refp[max(0,y0):y0+g.shape[0]+2*S, max(0,x0):x0+g.shape[1]+2*S]
    # edge-ish features to reduce glow influence
    def feat(a): 
        gx=cv2.Sobel(a,cv2.CV_32F,1,0,ksize=3); gy=cv2.Sobel(a,cv2.CV_32F,0,1,ksize=3); return np.sqrt(gx*gx+gy*gy)
    res=cv2.matchTemplate(feat(win),feat(g),cv2.TM_CCORR_NORMED,mask=m)
    res=np.nan_to_num(res,nan=-1,posinf=-1,neginf=-1)
    _,sc,_,loc=cv2.minMaxLoc(res)
    x=loc[0]+max(0,x0)-P; y=loc[1]+max(0,y0)-P
    out[k]=dict(x=int(x),y=int(y),w=w,h=h,score=round(float(sc),3))
    print(k.ljust(18),(mx,my),'->',(x,y),'size',(w,h),'score %.3f'%sc)
json.dump(out,open(str(ROOT/'tools'/'reg.json'),'w'),indent=1)
