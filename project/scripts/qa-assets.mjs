import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import sharp from 'sharp';
const root='apps/web/public/assets/finni'; const out='docs/qa/final';mkdirSync(out,{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const label=(s,w=180,h=40)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><text x="6" y="18" font-family="Arial" font-size="12" fill="#132c49">${esc(s)}</text></svg>`);
async function sheet(name, cells, columns=5){const w=180,h=220;const composite=[];for(let i=0;i<cells.length;i++){const [title,path]=cells[i];const x=(i%columns)*w,y=Math.floor(i/columns)*h;const img=await sharp(path).resize(170,175,{fit:'contain',background:'#e8edf4'}).png().toBuffer();composite.push({input:img,left:x+5,top:y+3},{input:label(title),left:x,top:y+180});}await sharp({create:{width:columns*w,height:Math.ceil(cells.length/columns)*h,channels:4,background:'#e8edf4'}}).composite(composite).png().toFile(`${out}/${name}.png`);}
const files=readdirSync(`${root}/characters`).filter(f=>f.endsWith('.webp'));const metadata=[];
for(const pet of ['cat','dragon','dog']){const cells=[];for(const file of files.filter(f=>f.startsWith(`pet-${pet}-`)).sort()){const m=await sharp(`${root}/characters/${file}`).metadata();metadata.push({file,width:m.width,height:m.height,alpha:m.hasAlpha});cells.push([file.replace(`pet-${pet}-`,'').replace('.webp',''),`${root}/characters/${file}`]);}await sheet(`assets-${pet}`,cells);}
const content=name=>JSON.parse(readFileSync(`packages/content/${name}.json`,'utf8'));
await sheet('assets-shop-goals',[...content('purchases').map(i=>[`${i.title}: ${i.price}`,`${root}/items/${i.assetId}.webp`]),...content('goals').map(g=>[`${g.title}: ${g.cost}`,`${root}/goals/${g.assetId}.webp`])]);
const situations=content('situations');for(const half of [0,1])await sheet(`assets-situations-${half+1}`,situations.slice(half*15,half*15+15).flatMap(s=>[[`${s.id} ${s.title}`,`${root}/situations/${s.hero}.webp`],...s.icons.map((icon,i)=>[`${s.id}.${i+1} ${s.options[i].slice(0,22)}`,`${root}/situations/${icon}.webp`])]),4);
writeFileSync(`${out}/asset-metadata.json`,JSON.stringify(metadata,null,2));console.log(`Decoded ${metadata.length} character assets, all catalog and situation images`);
