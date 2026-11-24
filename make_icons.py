# 由 logo-1024.png 生成网页图标与安卓图标（与 ChinaPaw 相同）。用法：python3 make_icons.py www | android [admin]
import sys, glob, os
from PIL import Image, ImageDraw
BG=(247,245,240)
L=Image.open('logo-1024.png').convert('RGBA')
def icon(sz,round_=False,fg=False):
    if fg:
        c=Image.new('RGBA',(sz,sz),(0,0,0,0)); s=int(sz*0.76); c.alpha_composite(L.resize((s,s),Image.LANCZOS),((sz-s)//2,(sz-s)//2)); return c
    im=L.resize((sz,sz),Image.LANCZOS)
    if round_:
        m=Image.new('L',(sz,sz),0); ImageDraw.Draw(m).ellipse((0,0,sz-1,sz-1),fill=255); im.putalpha(m)
    return im
def badge(im,admin):
    if not admin: return im
    d=ImageDraw.Draw(im); w=im.size[0]; r=int(w*0.2); d.ellipse((w-r*2-2,w-r*2-2,w-2,w-2),fill=(22,22,22,255))
    return im
admin=len(sys.argv)>2 and sys.argv[2]=='admin'
if sys.argv[1]=='www':
    for s in (192,512): icon(s).save(f'www/icon-{s}.png')
else:
    res='android/app/src/main/res'
    for f in glob.glob(res+'/mipmap-*/*.png'):
        n=os.path.basename(f); w=Image.open(f).size[0]
        badge(icon(w,'round' in n,'foreground' in n),admin and 'foreground' not in n).save(f)
    for f in glob.glob(res+'/drawable*/splash.png'):
        w,h=Image.open(f).size; im=Image.new('RGB',(w,h),BG); s=int(min(w,h)*0.30)
        im.paste(icon(s),((w-s)//2,(h-s)//2),icon(s)); im.save(f)
    p=res+'/values/ic_launcher_background.xml'
    if os.path.exists(p):
        open(p,'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#93BEEE</color></resources>\n')
