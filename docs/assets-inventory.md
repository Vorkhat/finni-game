# Инвентаризация production assets

Назначение: происхождение production-графики — исходные файлы и их WebP-копии.

## Содержание

- [CHARACTERS](#characters)
- [EMOTIONS](#emotions)
- [BACKGROUNDS](#backgrounds)
- [SHOP ITEMS](#shop-items)
- [GOALS](#goals)
- [STATUS](#status)
- [NAVIGATION](#navigation)
- [UI](#ui)
- [BRANDING](#branding)
- [OTHER](#other)
- [UNRESOLVED](#unresolved)

Источник: `C:\Users\alzhi\Downloads\финни`. Все 41 файла просмотрены на контактных листах; Home reference и UI atlas также изучены в полном размере.

Исходники не изменены. WebP-копии: качество 92, сохранён alpha, убраны только прозрачные поля; персонажи ≤800 px, товары ≤512 px, цели ≤600 px. Иконки — прямые фрагменты исходного атласа. Цвета и рисунки не перерисовывались.

Стадии s/m/l сопоставлены с BABY/EXPLORER/FINNI_PRO по видимым пропорциям, стойке и аксессуарам. Варианты внешности: cat/ginger и dragon/turquoise, других цветов в исходниках нет. Эмоции не выдаются за цветовые варианты.

## CHARACTERS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `дракончик\l2.png` | 1254×1254 | 1,427,078 | PNG | да | dragon, finni-pro, turquoise, idle | `characters/pet-dragon-turquoise-finni-pro-idle.webp` |
| `дракончик\m1.png` | 1254×1254 | 1,398,162 | PNG | да | dragon, explorer, turquoise, idle | `characters/pet-dragon-turquoise-explorer-idle.webp` |
| `дракончик\s1.png` | 1254×1254 | 1,054,465 | PNG | да | dragon, baby, turquoise, idle | `characters/pet-dragon-turquoise-baby-idle.webp` |
| `Котик\l1.png` | 1254×1254 | 1,395,744 | PNG | да | cat, finni-pro, ginger, idle | `characters/pet-cat-ginger-finni-pro-idle.webp` |
| `Котик\m1.png` | 1254×1254 | 1,329,176 | PNG | да | cat, explorer, ginger, idle | `characters/pet-cat-ginger-explorer-idle.webp` |
| `Котик\s1.png` | 1327×1185 | 1,402,319 | PNG | да | cat, baby, ginger, idle | `characters/pet-cat-ginger-baby-idle.webp` |

## EMOTIONS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `дракончик\l1.png` | 1254×1254 | 1,539,720 | PNG | да | dragon, finni-pro, turquoise, determined | `characters/pet-dragon-turquoise-finni-pro-determined.webp` |
| `дракончик\l3.png` | 1254×1254 | 1,528,458 | PNG | да | dragon, finni-pro, turquoise, surprised | `characters/pet-dragon-turquoise-finni-pro-surprised.webp` |
| `дракончик\m2.png` | 1254×1254 | 1,353,714 | PNG | да | dragon, explorer, turquoise, surprised | `characters/pet-dragon-turquoise-explorer-surprised.webp` |
| `дракончик\m3.png` | 1254×1254 | 1,346,300 | PNG | да | dragon, explorer, turquoise, determined | `characters/pet-dragon-turquoise-explorer-determined.webp` |
| `дракончик\s2.png` | 1254×1254 | 1,205,135 | PNG | да | dragon, baby, turquoise, surprised | `characters/pet-dragon-turquoise-baby-surprised.webp` |
| `дракончик\s3.png` | 1254×1254 | 1,219,809 | PNG | да | dragon, baby, turquoise, determined | `characters/pet-dragon-turquoise-baby-determined.webp` |
| `Котик\l2.png` | 1254×1254 | 1,472,282 | PNG | да | cat, finni-pro, ginger, happy | `characters/pet-cat-ginger-finni-pro-happy.webp` |
| `Котик\l3.png` | 1254×1254 | 1,538,255 | PNG | да | cat, finni-pro, ginger, sad | `characters/pet-cat-ginger-finni-pro-sad.webp` |
| `Котик\l4.png` | 1254×1254 | 1,490,913 | PNG | да | cat, finni-pro, ginger, surprised | `characters/pet-cat-ginger-finni-pro-surprised.webp` |
| `Котик\l5.png` | 1254×1254 | 1,644,769 | PNG | да | cat, finni-pro, ginger, determined | `characters/pet-cat-ginger-finni-pro-determined.webp` |
| `Котик\m2.png` | 1254×1254 | 1,345,235 | PNG | да | cat, explorer, ginger, happy | `characters/pet-cat-ginger-explorer-happy.webp` |
| `Котик\m3.png` | 1254×1254 | 1,322,596 | PNG | да | cat, explorer, ginger, surprised | `characters/pet-cat-ginger-explorer-surprised.webp` |
| `Котик\m4.png` | 1254×1254 | 1,430,367 | PNG | да | cat, explorer, ginger, determined | `characters/pet-cat-ginger-explorer-determined.webp` |
| `Котик\m5.png` | 1254×1254 | 1,300,328 | PNG | да | cat, explorer, ginger, sad | `characters/pet-cat-ginger-explorer-sad.webp` |
| `Котик\s2.png` | 1254×1254 | 1,441,945 | PNG | да | cat, baby, ginger, happy | `characters/pet-cat-ginger-baby-happy.webp` |
| `Котик\s3.png` | 1254×1254 | 1,378,905 | PNG | да | cat, baby, ginger, sad | `characters/pet-cat-ginger-baby-sad.webp` |
| `Котик\s4.png` | 1254×1254 | 1,451,384 | PNG | да | cat, baby, ginger, surprised | `characters/pet-cat-ginger-baby-surprised.webp` |
| `Котик\s5.png` | 1254×1254 | 1,448,638 | PNG | да | cat, baby, ginger, determined | `characters/pet-cat-ginger-baby-determined.webp` |

## BACKGROUNDS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `комната финни.png` | 941×1672 | 1,842,620 | PNG | нет | Комната Home, самостоятельный фон | `backgrounds/room-main.webp` |

## SHOP ITEMS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_19 (1).png` | 1254×1254 | 1,065,892 | PNG | да | breakfast | `items/item-breakfast.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_19 (2).png` | 1254×1254 | 1,158,014 | PNG | да | lunch | `items/item-lunch.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_20 (3).png` | 1254×1254 | 673,030 | PNG | да | care | `items/item-care.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_21 (4).png` | 1254×1254 | 722,809 | PNG | да | snack | `items/item-snack.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_21 (5).png` | 1254×1254 | 995,568 | PNG | да | ball | `items/item-ball.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_22 (6) — копия.png` | 1254×1254 | 965,435 | PNG | да | cap | `items/item-cap.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_22 (7).png` | 1254×1254 | 1,215,541 | PNG | да | toy | `items/item-toy.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_23 (8) — копия.png` | 1254×1254 | 699,840 | PNG | да | icecream | `items/item-icecream.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_23 (9).png` | 1254×1254 | 1,043,273 | PNG | да | game | `items/item-game.webp` |
| `магазин\ChatGPT Image 15 сент. 2026 г., 10_33_24 (10).png` | 1254×1254 | 618,597 | PNG | да | balloon | `items/item-balloon.webp` |

## GOALS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `Цели\ChatGPT Image 15 сент. 2026 г., 10_38_04 (1).png` | 1254×1254 | 912,612 | PNG | да | scooter | `goals/goal-scooter.webp` |
| `Цели\ChatGPT Image 15 сент. 2026 г., 10_38_04 (2).png` | 1254×1254 | 1,523,594 | PNG | да | pet-house | `goals/goal-pet-house.webp` |
| `Цели\ChatGPT Image 15 сент. 2026 г., 10_38_05 (3).png` | 1254×1254 | 826,336 | PNG | да | space-trip | `goals/goal-space-trip.webp` |

## STATUS

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | satiety | `icons/icon-satiety.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | mood | `icons/icon-mood.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | care | `icons/icon-care.webp` |

## NAVIGATION

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | home | `icons/icon-home.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | shop | `icons/icon-shop.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | savings | `icons/icon-savings.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | goals | `icons/icon-goals.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | tasks | `icons/icon-tasks.webp` |

## UI

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | coin | `icons/icon-coin.webp` |
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | settings | `icons/icon-settings.webp` |

## BRANDING

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `иконки.png` | 1215×1295 | 1,364,424 | PNG | да | Логотип Финни | `branding/logo-finni.webp` |

## OTHER

| Исходное имя | Размер px | Байт | Формат | Прозрачность | Назначение | Production имя |
|---|---|---|---|---|---|---|
| `home screen.png` | 940×1672 | 1,934,673 | PNG | нет | Визуальный референс Home; не используется как экран | `reference only` |
| `дракончик\ChatGPT Image 15 сент. 2026 г., 10_17_11.png` | 1536×1024 | 2,252,544 | PNG | да | Обзорный лист трёх стадий дракона; содержит артефакты фона, не используется в production | `reference only` |

## UNRESOLVED

Неопознанных файлов нет. Не подключены элементы атласа с вшитыми значениями «12», «120», заполненными шкалами и текстом кнопки: эти данные отображаются настоящими компонентами. Отдельного звукового файла нет. Лист эволюции и Home reference хранятся в исходной папке и на QA-контактных листах, в runtime не включены.
