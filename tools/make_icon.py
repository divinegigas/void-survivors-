# Usage: python3 tools/make_icon.py android/app/src/main/res
# Draws the Starburn launcher icon (original art) at every Android density.
import math, os, sys
from PIL import Image, ImageDraw
RES = sys.argv[1]
INK=(20,16,31,255); RED=(255,59,59,255); GOLD=(255,214,10,255); CYAN=(46,197,255,255); PAPER=(255,248,231,255); BG=(29,22,72,255)
def burst(d, cx, cy, r, spikes, fill, ink_w, seed=1):
    pts=[]
    for i in range(spikes*2):
        a=i/(spikes*2)*2*math.pi-math.pi/2
        rr = r*0.62 if i%2 else r*(0.92+0.12*math.sin(i*2.3+seed))
        pts.append((cx+math.cos(a)*rr, cy+math.sin(a)*rr))
    d.polygon(pts, fill=fill, outline=INK, width=ink_w)
def ship(img, cx, cy, s, ink_w):
    shape=[0,-16, 5,-4, 14,8, 5,6, 0,10, -5,6, -14,8, -5,-4]
    pts=[(cx+shape[i]*s, cy+shape[i+1]*s) for i in range(0,len(shape),2)]
    d=ImageDraw.Draw(img)
    d.polygon(pts, fill=CYAN)
    # cel shadow on the right half with halftone dots
    sh=Image.new('RGBA', img.size, (0,0,0,0)); sd=ImageDraw.Draw(sh)
    sd.polygon([(cx+0.1*s*15, cy-20*s),(cx+20*s,cy-20*s),(cx+20*s,cy+20*s),(cx-0.7*15*s,cy+20*s)], fill=(20,16,31,95))
    step=max(4,int(3.2*s))
    for y in range(int(cy-20*s), int(cy+20*s), step):
        for x in range(int(cx-20*s), int(cx+20*s), step):
            sd.ellipse([x-step*0.3,y-step*0.3,x+step*0.3,y+step*0.3], fill=(20,16,31,110))
    mask=Image.new('L', img.size, 0); ImageDraw.Draw(mask).polygon(pts, fill=255)
    clipped=Image.new('RGBA', img.size, (0,0,0,0)); clipped.paste(sh,(0,0),mask)
    img.alpha_composite(clipped)
    d=ImageDraw.Draw(img)
    d.line(pts+[pts[0]], fill=INK, width=ink_w, joint='curve')
    d.ellipse([cx-2.6*s, cy-8.5*s, cx+2.6*s, cy+0.5*s], fill=PAPER, outline=INK, width=max(2,ink_w//2))
    # flame
    d.polygon([(cx-4.5*s,cy+9*s),(cx,cy+24*s),(cx+4.5*s,cy+9*s)], fill=GOLD, outline=INK, width=max(2,ink_w//2))
def art(size, transparent, shape):
    N=1024
    img=Image.new('RGBA',(N,N),(0,0,0,0))
    d=ImageDraw.Draw(img)
    if not transparent:
        if shape=='round': d.ellipse([0,0,N-1,N-1], fill=BG)
        else: d.rounded_rectangle([0,0,N-1,N-1], radius=180, fill=BG)
    scale = 0.66 if transparent else 0.95       # adaptive icons get cropped: keep art in the safe zone
    c=N/2
    burst(d, c, c, N*0.46*scale, 14, RED, int(22*scale))
    burst(d, c, c, N*0.30*scale, 12, GOLD, int(16*scale), seed=3)
    ship(img, c, c-N*0.02*scale, N*0.0155*scale, int(20*scale))
    if not transparent and shape=='round':
        m=Image.new('L',(N,N),0); ImageDraw.Draw(m).ellipse([0,0,N-1,N-1], fill=255)
        out=Image.new('RGBA',(N,N),(0,0,0,0)); out.paste(img,(0,0),m); img=out
    return img.resize((size,size), Image.LANCZOS)
dens={'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
for k,m in dens.items():
    dd=os.path.join(RES,'mipmap-'+k)
    art(int(48*m),False,'square').save(os.path.join(dd,'ic_launcher.png'))
    art(int(48*m),False,'round').save(os.path.join(dd,'ic_launcher_round.png'))
    art(int(108*m),True,None).save(os.path.join(dd,'ic_launcher_foreground.png'))
art(512,False,'square').save(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(RES))))),'icon-512.png'))
print('icons ok')
