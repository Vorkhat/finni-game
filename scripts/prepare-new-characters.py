"""Add colour variants (cat white/black, dragon green/purple) and the new dog
species (dalmatian/brown/husky) to the production WebP set.

Reads straight from the supplied zip so no lossy round-trip; emotion order per
size prefix matches scripts/prepare-assets.py exactly. Existing assets and the
source zip are never modified.
"""
import io, zipfile
from pathlib import Path
from PIL import Image

SRC_ZIP = Path(r"C:\Users\alzhi\Downloads\Telegram Desktop\финни — новые цвета (2).zip")
DEST = Path("apps/web/public/assets/finni/characters")

# species-type -> {size prefix: emotion order}. Mirrors prepare-assets.py.
FIVE = {
    "s": ["idle", "happy", "sad", "surprised", "determined"],
    "m": ["idle", "happy", "surprised", "determined", "sad"],
    "l": ["idle", "happy", "sad", "surprised", "determined"],
}
THREE = {
    "s": ["idle", "surprised", "determined"],
    "m": ["idle", "surprised", "determined"],
    "l": ["determined", "idle", "surprised"],
}
STAGE = {"s": "baby", "m": "explorer", "l": "finni-pro"}

# (species, colour slug, zip folder, zip subfolder, emotion table)
VARIANTS = [
    ("cat", "white", "Котик", "Белый", FIVE),
    ("cat", "black", "Котик", "Черный", FIVE),
    ("dragon", "green", "дракончик", "Зеленый", THREE),
    ("dragon", "purple", "дракончик", "Фиолетовый", THREE),
    ("dog", "dalmatian", "Собачка", "Далматинец", FIVE),
    ("dog", "brown", "Собачка", "Коричневая", FIVE),
    ("dog", "husky", "Собачка", "Хаски", FIVE),
]


def fix(name: str) -> str:
    try:
        return name.encode("cp437").decode("cp866")
    except Exception:
        return name


def export(data: bytes, target: Path):
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((800, 800), Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target, "WEBP", quality=92, method=6)


z = zipfile.ZipFile(SRC_ZIP)
index = {fix(info.filename): info.filename for info in z.infolist()}
written = 0
for species, slug, folder, sub, table in VARIANTS:
    for prefix, emotions in table.items():
        for n, emotion in enumerate(emotions, 1):
            key = f"финни/{folder}/{sub}/{prefix}{n}.png"
            raw = index.get(key)
            if raw is None:
                raise SystemExit(f"Missing in zip: {key}")
            name = f"pet-{species}-{slug}-{STAGE[prefix]}-{emotion}.webp"
            export(z.read(raw), DEST / name)
            written += 1
print(f"Exported {written} character WebP files to {DEST}")
