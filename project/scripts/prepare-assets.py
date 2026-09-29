"""Reproducible loss-preserving production copies from the supplied, inspected art.
No recolouring or generated replacements. Source PNG files are never modified.
"""
from pathlib import Path
from PIL import Image
import json

root = Path(r'C:\Users\alzhi\Downloads\финни')
dest = Path('apps/web/public/assets/finni')
meta = json.loads(Path('docs/qa/assets/metadata.json').read_text(encoding='utf-8'))
mapping = {}

def export(source, name, category, purpose, box=None, trim=True, max_size=800):
    im = Image.open(root/source).convert('RGBA')
    if box: im = im.crop(box)
    if trim and im.getchannel('A').getbbox(): im = im.crop(im.getchannel('A').getbbox())
    im.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    target = dest / name
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target, 'WEBP', quality=92, method=6)
    mapping.setdefault(source, []).append((category, purpose, name))

for species, folder, color in [('cat','Котик','ginger'),('dragon','дракончик','turquoise')]:
    for prefix, stage in [('s','baby'),('m','explorer'),('l','finni-pro')]:
        if species == 'cat':
            emotions = ['idle','happy','sad','surprised','determined'] if prefix != 'm' else ['idle','happy','surprised','determined','sad']
        else:
            emotions = ['idle','surprised','determined'] if prefix != 'l' else ['determined','idle','surprised']
        for n, emotion in enumerate(emotions, 1):
            export(f'{folder}\\{prefix}{n}.png', f'characters/pet-{species}-{color}-{stage}-{emotion}.webp', 'CHARACTERS' if emotion == 'idle' else 'EMOTIONS', f'{species}, {stage}, {color}, {emotion}')

items = ['breakfast','lunch','care','snack','ball','cap','toy','icecream','game','balloon']
for row, item in zip([r for r in meta if r['source'].startswith('магазин')], items):
    export(row['source'], f'items/item-{item}.webp', 'SHOP ITEMS', item, max_size=512)
for row, goal in zip([r for r in meta if r['source'].startswith('Цели')], ['scooter','pet-house','space-trip']):
    export(row['source'], f'goals/goal-{goal}.webp', 'GOALS', goal, max_size=600)
export('комната финни.png', 'backgrounds/room-main.webp', 'BACKGROUNDS', 'Комната Home, самостоятельный фон', trim=False, max_size=1672)

# Coordinates were identified visually in the supplied 1215 × 1295 atlas.
icons = {
    'coin': ('UI', (748,163,876,304)),
    'settings': ('UI', (1035,135,1208,318)),
    'satiety': ('STATUS', (28,395,193,529)),
    'mood': ('STATUS', (439,391,576,531)),
    'care': ('STATUS', (853,392,963,535)),
    'home': ('NAVIGATION', (42,910,296,1137)),
    'shop': ('NAVIGATION', (349,926,581,1138)),
    'savings': ('NAVIGATION', (626,900,887,1142)),
    'goals': ('NAVIGATION', (919,921,1177,1138)),
    'tasks': ('NAVIGATION', (302,624,487,822))
}
for name, (category, box) in icons.items():
    export('иконки.png', f'icons/icon-{name}.webp', category, name, box=box, max_size=300)
export('иконки.png', 'branding/logo-finni.webp', 'BRANDING', 'Логотип Финни', box=(287,62,748,325), max_size=600)

intro = '# Инвентаризация production assets\n\nИсточник: `C:\\Users\\alzhi\\Downloads\\финни`. Все 41 файла просмотрены на контактных листах; Home reference и UI atlas также изучены в полном размере.\n\nИсходники не изменены. WebP-копии: качество 92, сохранён alpha, убраны только прозрачные поля; персонажи ≤800 px, товары ≤512 px, цели ≤600 px. Иконки — прямые фрагменты исходного атласа. Цвета и рисунки не перерисовывались.\n\nСтадии s/m/l сопоставлены с BABY/EXPLORER/FINNI_PRO по видимым пропорциям, стойке и аксессуарам. Варианты внешности: cat/ginger и dragon/turquoise, других цветов в исходниках нет. Эмоции не выдаются за цветовые варианты.\n\n'
sections = {name: [] for name in ['CHARACTERS','EMOTIONS','BACKGROUNDS','SHOP ITEMS','GOALS','STATUS','NAVIGATION','UI','BRANDING','OTHER']}
for row in meta:
    source = row['source']
    entries = mapping.get(source)
    if not entries:
        purpose = 'Визуальный референс Home; не используется как экран' if source == 'home screen.png' else 'Обзорный лист трёх стадий дракона; содержит артефакты фона, не используется в production'
        entries = [('OTHER',purpose,'reference only')]
    for category, purpose, name in entries:
        sections[category].append(f"| `{source}` | {row['width']}×{row['height']} | {row['bytes']:,} | PNG | {'да' if row['alpha'] else 'нет'} | {purpose} | `{name}` |")
text = intro
for category, rows in sections.items():
    text += f'## {category}\n\n| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |\n|---|---|---|---|---|---|---|\n' + '\n'.join(rows) + '\n\n'
text += '## UNRESOLVED\n\nНеопознанных файлов нет. Не подключены элементы атласа с вшитыми значениями «12», «120», заполненными шкалами и текстом кнопки: эти данные отображаются настоящими компонентами. Отдельного звукового файла нет. Лист эволюции и Home reference хранятся в исходной папке и на QA-контактных листах, в runtime не включены.\n'
Path('docs/assets-inventory.md').write_text(text, encoding='utf-8')
print(f'Exported {len(list(dest.rglob("*.webp")))} assets; {sum(p.stat().st_size for p in dest.rglob("*.webp")) / 1024 / 1024:.2f} MiB')
