from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root = Path(r'C:\Users\alzhi\Downloads\финни')
out = Path('docs/qa/assets')
out.mkdir(parents=True, exist_ok=True)
files = sorted(root.rglob('*.png'))
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
rows = []
for index, path in enumerate(files):
    im = Image.open(path)
    alpha = im.convert('RGBA').getchannel('A').getextrema()
    rows.append({'index': index, 'source': str(path.relative_to(root)), 'width': im.width, 'height': im.height, 'bytes': path.stat().st_size, 'format': im.format, 'alpha': alpha[0] < 255, 'mode': im.mode})
for start in range(0, len(files), 16):
    sheet = Image.new('RGB', (1000, 1100), '#edf0f4')
    draw = ImageDraw.Draw(sheet)
    for n, path in enumerate(files[start:start+16]):
        im = Image.open(path).convert('RGBA')
        im.thumbnail((230, 225))
        x, y = (n % 4) * 250, (n // 4) * 275
        sheet.paste(im, (x + (250-im.width)//2, y), im)
        draw.text((x+8,y+230), f'{start+n}: {path.parent.name}/{path.stem[:20]}', font=font, fill='#162238')
    sheet.save(out / f'contact-{start//16}.jpg')
(out/'metadata.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
