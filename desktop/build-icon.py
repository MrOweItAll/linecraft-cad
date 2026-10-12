"""Render the independently authored Linecraft mark; build-time Pillow only."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
size = 1024
scale = size / 32
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=6*scale, fill='#18262f')
paths = [[(5,25),(5,7),(14,7)], [(11,25),(27,25),(27,11)], [(5,25),(27,5)]]
for points in paths:
    scaled = [(round(x*scale), round(y*scale)) for x,y in points]
    draw.line(scaled, fill='#67dcc5', width=round(2*scale), joint='curve')
    for x,y in scaled:
        draw.ellipse((x-scale,y-scale,x+scale,y+scale),fill='#67dcc5')
image.resize((256,256), Image.Resampling.LANCZOS).save(root/'icon.png')
image.save(root/'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Original Linecraft icon rendered at seven Windows resolutions.')
