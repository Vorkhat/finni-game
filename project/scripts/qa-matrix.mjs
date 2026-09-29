import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(`packages/content/${name}.json`, 'utf8'));
const routes = [...readFileSync('apps/web/src/index.tsx', 'utf8').matchAll(/"(\/(?:[a-z][a-z/:*-]*)?)"/g)].map(m => m[1]);
const pets = {cat:['ginger','white','black'], dragon:['turquoise','green','purple'], dog:['dalmatian','brown','husky']};
const stages = ['BABY','EXPLORER','FINNI_PRO'];
const states = ['idle','happy','sad','surprised','determined','low-satiety','low-mood','low-care','maximum-stats'];
const scenarios = ['render','navigation','reload'];
const rows = [];
for (const screen of ['/home','/shop','/tasks/:id','/situations/:id','/savings','/day/result','/day/evolution','/progress'])
  for (const [pet, colors] of Object.entries(pets)) for (const color of colors) for (const stage of stages)
    for (const state of states) for (const scenario of scenarios) rows.push({screen,pet,color,stage,state,scenario,status:'planned'});
mkdirSync('docs/qa/final', {recursive:true});
writeFileSync('docs/qa/final/matrix.json', JSON.stringify({generatedAt:new Date().toISOString(),routes:[...new Set(routes)],pets,stages,states,scenarios,content:{tasks:read('tasks'),situations:read('situations'),purchases:read('purchases'),goals:read('goals'),events:read('events')},rows},null,2));
writeFileSync('docs/qa/final/MATRIX.md', `# Матрица финального QA\n\nСформирована до запуска тестов. Полный набор комбинаций: matrix.json (${rows.length} плановых строк). Плановые строки не являются доказательством прохождения; фактическое покрытие и ограничения — FINAL_QA_REPORT.md.\n\nМаршруты: ${[...new Set(routes)].join(', ')}.\n\nПитомцы: cat (ginger/white/black), dragon (turquoise/green/purple), dog (dalmatian/brown/husky). Стадии: ${stages.join(', ')}. У дракона happy/sad используют idle того же цвета и возраста. Энергии как характеристики нет: satiety/mood/care.\n\n| Область | Обязательные сценарии |\n|---|---|\n| First run | обучение, назад, питомец/цвет/имя, каждый reload, цель, guards |\n| Финансы | доход один раз, шаг 5, draft, confirm/lock, все покупки, нехватка, двойной tap, deposit/withdraw preview/cancel/confirm |\n| Контент | все 6 заданий и все жизненные ситуации, неверное/верное решение, награда, повтор, reload |\n| День | 5 последовательных периодов, события, Plan/Actual, исторические snapshots, обе эволюции для каждого вида |\n| Цели | все 3, 0/частично/100%/сверх стоимости, смена, reload |\n| Модальные окна | бюджет, покупка/успех/нехватка, копилка, Home day/story/finish/result, событие, настройки, demo, reset/delete |\n| Состояние | обычный/demo, reset/delete, corrupted/old storage, отказ записи, отсутствующий asset |\n| Mobile | 320×568, 360×640, 390×844, 412×915, короткий viewport клавиатуры; overflow, hitboxes, прокрутка |\n| Android | статическая проверка wrapper + доступное устройство/эмулятор; недоступные проверки отмечать явно |\n`);
console.log(`Generated ${rows.length} planned combinations`);
