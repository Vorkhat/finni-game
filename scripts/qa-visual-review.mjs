import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const out='docs/qa/final';
const groups={
  screens: ['docs/qa/onboarding-390.png','docs/qa/concepts-390.png','docs/qa/pet-creation-390.png','docs/qa/goal-selection-390.png', ...readdirSync(out).filter(f=>f.endsWith('edge-568-320.png')).map(f=>`${out}/${f}`)],
  adult: readdirSync('docs/qa/stage4').filter(f=>f.endsWith('-390.png')).map(f=>`docs/qa/stage4/${f}`),
  tasks: readdirSync('docs/qa/stage2').filter(f=>f.endsWith('-390.png')).map(f=>`docs/qa/stage2/${f}`),
  pets: readdirSync(out).filter(f=>/-(BABY|EXPLORER|FINNI_PRO)-idle-390\.png$/.test(f)).map(f=>`${out}/${f}`),
};
for(const [group,files]of Object.entries(groups)){
 for(let part=0;part<Math.ceil(files.length/12);part++){
  const subset=files.slice(part*12,part*12+12), composite=[]; const w=260,h=585,cols=4;
  for(const [i,p]of subset.entries()){
   const img=await sharp(p).resize(w,h-25,{fit:'contain',background:'#dde4ed'}).png().toBuffer();
   const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="25"><rect width="100%" height="100%" fill="white"/><text x="4" y="16" font-family="Arial" font-size="9">${p.split('/').at(-1)}</text></svg>`);
   composite.push({input:img,left:i%cols*w,top:Math.floor(i/cols)*h},{input:label,left:i%cols*w,top:Math.floor(i/cols)*h+h-25});
  }
  await sharp({create:{width:cols*w,height:Math.ceil(subset.length/cols)*h,channels:4,background:'#dde4ed'}}).composite(composite).png().toFile(`${out}/review-${group}-${part+1}.png`);
 }
}
