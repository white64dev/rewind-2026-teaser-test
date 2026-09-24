# Builds color + normal/shadow-mask textures and a manifest for the relight renderer.
import numpy as np, cv2, json, os
from PIL import Image
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=str(ROOT/'raw')          # Figma exports (not committed; see README)
OUT=str(ROOT/'public'/'assets'); os.makedirs(OUT,exist_ok=True)
reg=json.load(open(str(ROOT/'tools'/'reg.json')))
reg['d02_img4'].update(x=1691,y=621); reg['d04_note'].update(x=153,y=534)

# name: z(height), r(bevel px), hs(shape height), det(detail), spec, gloss, cast(shadow alpha), baked(keep baked shadow)
P={
 'd01_img59':(10,6,6,1.0,.25,30,.55,.45),
 'd02_img4':(1,2,.6,.8,.05,10,.35,.5),
 'd03_paper':(1,2,.6,.9,.05,10,.35,.5),
 'd04_note':(1.5,2,.6,.8,.05,10,.35,.5),
 'd05_newspaper_l':(2,2,.8,.9,.05,10,.35,.5),
 'd06_badge':(3,3,1.5,1.2,.35,40,.45,.5),
 'd07_img10':(1.5,2,.6,.8,.3,40,.35,.5),
 'd08_img54':(45,14,18,1.4,.25,25,.6,.35),
 'd09_group32':(3,2,.8,.8,.05,10,.4,.5),
 'd10_img42':(40,18,20,1.2,.45,45,.6,.3),
 'd11_photocard':(1.5,2,.6,.7,.25,40,.35,.5),
 'd12_photo':(1.5,2,.6,.7,.25,40,.35,.5),
 'd13_img9':(1.5,2,.6,.8,.1,20,.35,.5),
 'd14_puzzle':(3,3,1,.9,.1,15,.45,.5),
 'd15_newspaper_r':(4,3,1.2,.9,.05,10,.45,.5),
 'd16_note':(1,1,.4,.6,.05,10,.3,.5),
 'd17_note':(1,1,.4,.6,.05,10,.3,.5),
 'd18_note':(1,1,.4,.6,.05,10,.3,.5),
 'd19_photo':(1.5,2,.6,.7,.25,40,.35,.5),
 'd20_metrocard':(2,2,.8,.8,.3,40,.4,.5),
 'd21_folder':(6,4,2,1.0,.08,15,.5,.4),
 'd22_scissor':(8,5,4,1.0,.6,60,.55,.3),
 'd23_stapler':(22,9,10,1.1,.5,50,.6,.3),
 'd24_pencil':(6,4,4,.8,.35,40,.55,.35),
 'd25_ruler':(5,3,2.5,1.0,.3,35,.5,.35),
 'd26_manual':(4,3,1.2,.9,.2,30,.45,.45),
 'd27_coffee':(35,16,16,1.0,.8,90,.55,.3),
 'd28_typewriter':(60,20,22,1.6,.6,55,.65,.3),
 'd29_tw_copy':(62,1,0,0,0,10,0,1.0),
 'd32_lamp':(90,14,24,1.2,.7,70,.6,.25),
}
def lum(rgb): return (rgb[...,0]*.299+rgb[...,1]*.587+rgb[...,2]*.114)
def build(name,img,scale,x,y,w,h,z,r,hs,det,spec,gloss,cast,baked,maxside=1500,nscale=1.0,bake_sep=True,flat=False):
    a=img[...,3]/255.
    # optional downscale for budget
    s=min(1.0,maxside/max(img.shape[:2])); 
    if s<1:
        img=cv2.resize(img,(round(img.shape[1]*s),round(img.shape[0]*s)),interpolation=cv2.INTER_AREA); scale*=s; a=img[...,3]/255.
    sig=max(2.0,1.5+z*0.18)          # shadow softness in design px (taller = softer)
    pad=2 if flat else ((int(np.ceil(sig*3*scale))+2) if bake_sep else 0)
    img=cv2.copyMakeBorder(img,pad,pad,pad,pad,cv2.BORDER_CONSTANT,value=0) if pad else img; a=img[...,3]/255.
    core=np.clip((a-0.85)/0.1,0,1) if bake_sep else a
    # height: rounded bevel from distance to silhouette + luminance high-pass detail
    dist=cv2.distanceTransform((core>0.5).astype(np.uint8),cv2.DIST_L2,5)/scale
    prof=np.sin(np.clip(dist/max(r,1e-3),0,1)*np.pi/2)
    L=lum(img[...,:3].astype(np.float32)/255.)
    hp=cv2.GaussianBlur(L,(0,0),0.8*scale)-cv2.GaussianBlur(L,(0,0),5*scale)
    H=(hs*prof+det*hp*6.0)*core
    H=cv2.GaussianBlur(H.astype(np.float32),(0,0),0.6*scale)
    gx=cv2.Sobel(H,cv2.CV_32F,1,0,ksize=3)/8*scale; gy=cv2.Sobel(H,cv2.CV_32F,0,1,ksize=3)/8*scale
    n=np.dstack([-gx,gy,np.ones_like(gx)]); n/=np.linalg.norm(n,axis=2,keepdims=True)
    sm=cv2.GaussianBlur((core>0.5).astype(np.float32),(0,0),sig*scale)
    nm=np.dstack([(n*0.5+0.5)*255, sm[...,None]*255]).astype(np.uint8)
    if flat: nm[...,0]=128; nm[...,1]=128; nm[...,2]=255; nm[...,3]=0   # printed matter: no relief, no cast
    col=img.astype(np.uint8)
    if nscale!=1.0:
        nm=cv2.resize(nm,(round(nm.shape[1]*nscale),round(nm.shape[0]*nscale)),interpolation=cv2.INTER_AREA)
    Image.fromarray(col,'RGBA').save(f'{OUT}/{name}.webp',quality=88,method=6)
    Image.fromarray(nm,'RGBA').save(f'{OUT}/{name}_n.webp',quality=90,method=6)
    padu=pad/scale
    return dict(name=name,x=x-padu,y=y-padu,w=w+2*padu,h=h+2*padu,z=z,spec=spec,gloss=gloss,cast=cast,baked=baked,sig=sig)

man={'desk':[],'wall':[]}
# desk base (opaque) – crop to useful area, 1.5x
b=np.array(Image.open(R+'/parts/base_img.png').convert('RGBA'))  # desk + carpet without the chair, 2x of 2799.8x1188 at (-535.75,-75)
bx0,bx1=-400,2128  # design px range kept
c0=int((bx0+535.75)*2); c1=int((bx1+535.75)*2)
b=b[:,c0:c1]
b=cv2.resize(b,(round(b.shape[1]*.75),round(b.shape[0]*.75)),interpolation=cv2.INTER_AREA)
b=b[int(75*1.5):]  # desk frame starts at y=0 (the corner where desk meets wall)
e=build('d00_base',b,1.5,bx0,0,bx1-bx0,1113,0,1,0,.7,.12,20,0,1,maxside=4000,nscale=.67,bake_sep=False)
e.update(x=bx0,y=0,w=bx1-bx0,h=1113); man['desk'].append(e)  # opaque: no pad compensation needed
ch=np.array(Image.open(R+'/parts/chair.png').convert('RGBA'))
man['desk'].append(build('d00b_chair',ch,2.0,948.08-535.75,946.03-75,ch.shape[1]/2,ch.shape[0]/2,8,6,3,1,.3,30,.45,.4))
FLAT={'d29_tw_copy'}
for k,p in P.items():
    im=np.array(Image.open(f'{R}/{k}.png').convert('RGBA'))
    g=reg[k]
    if k=='d21_folder':
        # split so the Metrorail map can slide down into the folder: back | map | front
        PP=R+'/parts'; F=im.copy(); H,Wd=F.shape[:2]
        def lay(n,xy):
            c=np.zeros_like(F); a=np.array(Image.open(f'{PP}/{n}.png').convert('RGBA')); x,y=xy
            h,w=min(a.shape[0],H-y),min(a.shape[1],Wd-x); c[y:y+h,x:x+w]=a[:h,:w]; return c
        front=np.zeros(F.shape[:2],bool)
        for n,xy in [('f4_folder2',(0,41)),('f5_img55',(164,81)),('f6_folder3',(0,41)),('f9_img58',(75,406))]: front|=lay(n,xy)[...,3]>8
        mp=lay('f3_photo',(110,0)); mapA=mp[...,3]>8
        behind=Image.new('RGBA',(Wd,H),(0,0,0,0))
        for n,xy in [('f1_folderback',(0,41)),('f2_paper',(100,18))]: behind.alpha_composite(Image.fromarray(lay(n,xy)))
        behind=np.array(behind)
        back=F.copy(); m=mapA&~front; back[m]=behind[m]; back[front]=0
        frontI=np.zeros_like(F); frontI[front]=F[front]
        for nm,img in [('d21a_folder_back',back),('d21b_map',mp),('d21c_folder_front',frontI)]:
            man['desk'].append(build(nm,img,2.0,g['x'],g['y'],g['w'],g['h'],*p))
        continue
    if k=='d28_typewriter':
        # lift the sheet out of the typewriter so it can feed and slide; rebuild the platen it covered
        a=im.astype(np.int32); sub=a[:268,790:1280]
        pap=(sub[...,3]>200)&(sub[...,0]>200)&(sub[...,1]>185)&(sub[...,2]>170)&((sub.max(-1)[...,]-sub[...,:3].min(-1))<60)
        pap=cv2.morphologyEx(pap.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
        pap=cv2.dilate(pap,np.ones((7,7),np.uint8)).astype(bool) & (sub[...,3]>0)   # take the sheet's soft edge too
        sheet=np.zeros_like(im); sheet[:268,790:1280][pap]=im[:268,790:1280][pap]
        ys,xs=np.where(sheet[...,3]>0); sx0,sx1,sy1=xs.min(),xs.max()+1,ys.max()+1
        sh=sheet[0:sy1,sx0:sx1]
        tw=im.copy(); reg_=tw[:268,790:1280]; reg_[pap]=0
        col=im[166:266,1288:1289].copy()
        tw[166:266,790:1280]=np.repeat(col,490,axis=1)
        im=tw
        man['desk'].append(build(k,im,2.0,g['x'],g['y'],g['w'],g['h'],*p))
        sx,sy=g['x']+sx0/2,g['y']
        e=build('d33_sheet',sh,2.0,sx,sy,sh.shape[1]/2,sh.shape[0]/2,61,1,0,0,0,10,0,1.0,flat=True)
        e['clipY']=g['y']+266/2          # the paper bail: sheet and type vanish below this line
        man['desk'].append(e); continue
    e=build(k,im,2.0,g['x'],g['y'],g['w'],g['h'],*p,flat=k in FLAT)
    if k=='d29_tw_copy':
        # typing lines: v bands (top-based, padded uv) and ink extents per line
        a=np.array(Image.open(f'{OUT}/{k}.webp'))[...,3]>100
        Hh,Ww=a.shape; rows=a.any(1)
        bands=[(0,.28),(.28,.70),(.70,1.0)]; lines=[]
        for (v0,v1),n in zip(bands,[10,12,10]):
            r0,r1=int(v0*Hh),int(v1*Hh); cols=np.where(a[r0:r1].any(0))[0]
            lines.append(dict(v0=v0,v1=v1,u0=float(cols.min()/Ww),u1=float((cols.max()+1)/Ww),n=n))
        e['lines']=lines; e['clipY']=reg['d28_typewriter']['y']+266/2
    man['desk'].append(e)
# wall
wb=np.array(Image.open(R+'/wall_bg.png').convert('RGBA'))
e=build('wall_bg',wb,1.0,-66,0,1859,1038,0,1,0,1.2,.05,10,0,1,maxside=4000,bake_sep=False); e.update(x=-66,y=0,w=1859,h=1038); man['wall'].append(e)
ws=np.array(Image.open(R+'/wall_sign.png').convert('RGBA'))
ws=ws[380:720, 90:1995]  # crop to letters+shadow (1x export)
man['wall'].append(build('wall_sign',ws,1.0,-189+90,-54+380,1905,340,30,3,2.5,1.4,.35,35,.55,.3,maxside=4000))
# wall copy + clock straight from the comp (resized to 2x textures), printed flat on the wall
for nm,src,x,y,w,h in [('wall_copy','wall_subheader.png',447,615,381,153),('wall_clock','clock_v2.png',799.1,615,564,423)]:
    im=Image.open(R+'/parts/'+src).convert('RGBA'); im=im.resize((round(w*2),round(h*2)),Image.LANCZOS)
    man['wall'].append(build(nm,np.array(im),2.0,x,y,w,h,0,1,0,0,0,10,0,1.0,flat=True))
# lamp light: the comp's Shine and typewriter Glow, as Figma rendered them (blur, gradient, opacity baked).
# Only their alpha is kept; main.js tints them #EDCB80 and blends them the way Figma does.
for src,dst in [('d31_shine.png','light_shine.webp'),('d30_tw_glow.png','light_glow.webp')]:
    a=Image.open(R+'/'+src).convert('RGBA').getchannel('A'); a=a.resize((a.width//2,a.height//2),Image.LANCZOS)
    Image.merge('RGBA',[a,a,a,a]).save(str(ROOT/'public'/'assets'/dst),'WEBP',lossless=True)
json.dump(man,open(str(ROOT/'public'/'assets'/'manifest.json'),'w'),indent=1)
print('ok'); 
