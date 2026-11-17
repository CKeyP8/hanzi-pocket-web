import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function boot(initial:Record<string,unknown>={}){
 const dom=new JSDOM('<div id="hp-stem-demo"><div data-demo-app></div></div>',{url:'https://ckeyp8.github.io/hanzi-pocket-web/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,doc=w.document;
 Object.assign(w,{structuredClone,confirm:()=>true});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const saved:any[]=[];w.fetch=async(url:any)=>({ok:true,json:async()=>JSON.parse(readFileSync('public/'+new URL(url).pathname.split('/').at(-1),'utf8'))})as any;
 (w as any).HPAppConfig={production:true,version:'3.1',offlineReady:true,initialPayload:{format:'hanzi-pocket',version:3,state:{panel:'review',mode:'normal',saved:['old-word'],customWords:[{id:'old-word',h:'量子计算',p:'liàngzǐ jìsuàn',m:'my own definition',source:'personal'}],groups:[{id:'course',name:'My course'}],memberships:{'old-word':['course']},progress:{'personal:normal:old-word':{attempts:4,correct:false}},queues:{},...initial}},save:async(value:any)=>{saved.push(structuredClone(value));},lookup:async()=>[{pinyin:'liàngzǐ jìsuàn',meaning:'quantum computing'}]};
 w.eval(readFileSync('public/pocket-quiz.js','utf8'));w.eval(readFileSync('public/pocket-app.js','utf8'));
 for(let i=0;i<100&&!doc.querySelector('.hp-nav');i++)await new Promise(r=>setTimeout(r,5));
 const click=(action:string)=>{const scope=doc.querySelector('dialog[open]')||doc,button=scope.querySelector(`[data-action="${action}"]`)as HTMLButtonElement;expect(button,action).not.toBeNull();expect(button.disabled).toBe(false);button.click();};
 return {dom,w,doc,saved,click};
}
describe('Approved production interface',()=>{
 it('keeps bulk collection assignment available in the approved gallery',async()=>{
  const {dom,doc,w,click,saved}=await boot();click('nav-pocket');click('select');click('word-old-word');click('organize');
  const box=doc.querySelector('[name="groups"][value="course"]') as HTMLInputElement;expect(box).not.toBeNull();box.checked=true;doc.querySelector('form')!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,5));expect(saved.at(-1).state.memberships['old-word']).toEqual(['course']);dom.window.close();
 });
 it('opens existing Pocket records, uses Flashcards, and retains Settings/offline status',async()=>{
  const {dom,doc,click}=await boot();expect(doc.body.textContent).toContain('1 saved words');expect(doc.querySelector('[data-action="mode-normal"]')?.textContent).toBe('Flashcards');expect(doc.body.textContent).not.toContain('Preview');
  click('settings');expect(doc.body.textContent).toContain('Ready for offline use');expect(doc.querySelector('[data-restore-backup]')).not.toBeNull();expect(doc.querySelector('[data-import-csv]')).not.toBeNull();dom.window.close();
 });
 it('edits a migrated word without dropping its group or progress, and supports dictionary suggestions',async()=>{
  const {dom,doc,w,click,saved}=await boot();click('nav-pocket');click('word-old-word');click('edit-word-old-word');
  expect((doc.querySelector('[name="hanzi"]')as HTMLInputElement).value).toBe('量子计算');expect((doc.querySelector('[name="groups"]')as HTMLInputElement).checked).toBe(true);
  click('dictionary-lookup');await new Promise(r=>setTimeout(r,5));(doc.querySelector('[data-dictionary-results] button')as HTMLButtonElement).click();
  doc.querySelector('form')!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,5));
  const state=saved.at(-1).state;expect(state.customWords).toHaveLength(1);expect(state.customWords[0].m).toBe('quantum computing');expect(state.memberships['old-word']).toEqual(['course']);expect(state.progress['personal:normal:old-word'].attempts).toBe(4);dom.window.close();
 });
 it('offers all official vocabulary and saves quiz feedback through the production store',async()=>{
  const {dom,doc,click,saved}=await boot();click('nav-hsk');expect(doc.body.textContent).toContain('3,600');click('nav-stem');expect(doc.body.textContent).toContain('950');click('tab-csca');expect(doc.body.textContent.replace(/[,\s\u202f]/g,'')).toContain('5164');
  click('nav-review');click('quiz-open');click('quiz-start');expect(doc.querySelectorAll('.hp-quiz-choice')).toHaveLength(4);click('quiz-choice-0');await new Promise(r=>setTimeout(r,5));expect(doc.querySelector('.hp-quiz-feedback')).not.toBeNull();expect(saved.at(-1).state.quiz.totals.everyday.total).toBe(1);dom.window.close();
 });
});

const csca=JSON.parse(readFileSync('public/csca-catalog.json','utf8'));

async function gestureStudy(revealed=true){
 const context=await boot({panel:'hsk',deck:'hsk-1',study:true,revealed,queues:{'hsk-1:normal':['hsk2026-1','hsk2026-2','hsk2026-3']}});
 const {doc,w}=context,app=doc.querySelector('[data-demo-app]')as HTMLElement,captures:number[]=[],releases:number[]=[];
 (app as any).setPointerCapture=(id:number)=>captures.push(id);(app as any).releasePointerCapture=(id:number)=>releases.push(id);
 const pointer=(type:string,x:number,y:number,id=1,primary=true)=>{
  const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
  Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:primary},pointerType:{value:'touch'}});
  (doc.querySelector('.hp-reveal')??app).dispatchEvent(event);
 };
 return {...context,app,pointer,captures,releases};
}
describe('Horizontal practice gestures',()=>{
 it.each([{dx:-110,correct:true},{dx:110,correct:false}])('ignores initial vertical drift before a horizontal swipe ($correct)',async({dx,correct})=>{
  const {dom,doc,pointer,saved,captures}=await gestureStudy();
  pointer('pointerdown',190,250);pointer('pointermove',192,284);pointer('pointermove',190+dx,292);
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe(`translateX(${dx}px)`);
  pointer('pointerup',190+dx,292);pointer('pointerup',190+dx,292);
  expect(saved.at(-1).state.progress['hsk:normal:hsk2026-1']).toEqual({attempts:1,correct});
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('八');expect(captures).toEqual([1]);dom.window.close();
 });
 it.each([false,true])('ignores vertical movement and its synthetic click (revealed=%s)',async revealed=>{
  const {dom,doc,pointer,saved}=await gestureStudy(revealed);
  pointer('pointerdown',190,240);pointer('pointermove',193,410);pointer('pointerup',193,410);
  (doc.querySelector('.hp-reveal')as HTMLButtonElement).click();
  expect(doc.querySelector('dialog')).toBeNull();expect(saved).toHaveLength(0);
  expect(doc.querySelector('.hp-answer')!==null).toBe(revealed);dom.window.close();
 });
 it('snaps a short horizontal drag back without grading or opening details',async()=>{
  const {dom,doc,pointer,saved,releases}=await gestureStudy();pointer('pointerdown',190,250);pointer('pointermove',225,260);
  pointer('pointerup',225,260);(doc.querySelector('.hp-reveal')as HTMLButtonElement).click();
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe('');expect(doc.querySelector('.hp-dragging')).toBeNull();
  expect(saved).toHaveLength(0);expect(releases).toEqual([1]);expect(doc.querySelector('dialog')).toBeNull();dom.window.close();
 });
 it.each(['pointercancel','lostpointercapture'])('cleans up a %s without grading',async event=>{
  const {dom,doc,pointer,saved}=await gestureStudy();pointer('pointerdown',190,250);pointer('pointermove',150,260);pointer(event,150,260);pointer('pointerup',80,260);
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe('');expect(doc.querySelector('.hp-dragging')).toBeNull();expect(saved).toHaveLength(0);dom.window.close();
 });
 it('cancels a drag when a second finger starts a pinch',async()=>{
  const {dom,doc,pointer,saved}=await gestureStudy();pointer('pointerdown',190,250);pointer('pointermove',150,260);pointer('pointerdown',300,260,2,false);pointer('pointerup',70,260);
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe('');expect(saved).toHaveLength(0);dom.window.close();
 });
 it('keeps an unrevealed swipe from grading or turning into a reveal tap',async()=>{
  const {dom,doc,pointer,saved}=await gestureStudy(false);pointer('pointerdown',190,250);pointer('pointermove',70,260);pointer('pointerup',70,260);(doc.querySelector('.hp-reveal')as HTMLButtonElement).click();
  expect(doc.querySelector('.hp-answer')).toBeNull();expect(saved).toHaveLength(0);dom.window.close();
 });
 it('retains tap-to-reveal, full details and answer buttons, then unlocks scrolling when leaving',async()=>{
  const {dom,doc,pointer,click,saved}=await gestureStudy(false);expect(doc.documentElement.classList.contains('hp-study-active')).toBe(true);
  pointer('pointerdown',190,250);pointer('pointerup',190,250);click('reveal');expect(doc.querySelector('.hp-answer')).not.toBeNull();
  click('reveal');expect(doc.querySelector('dialog[open]')).not.toBeNull();expect(doc.querySelector('dialog')?.textContent).toContain('love');click('close-modal');click('correct');
  expect(saved.at(-1).state.progress['hsk:normal:hsk2026-1'].correct).toBe(true);click('leave');expect(doc.documentElement.classList.contains('hp-study-active')).toBe(false);dom.window.close();
 });
 it('accepts a new deliberate tap immediately after a swipe while suppressing its trailing click',async()=>{
  const {dom,doc,pointer}=await gestureStudy();pointer('pointerdown',190,250);pointer('pointermove',70,260);pointer('pointerup',70,260);
  (doc.querySelector('.hp-reveal')as HTMLButtonElement).click();expect(doc.querySelector('.hp-answer')).toBeNull();
  pointer('pointerdown',190,250);pointer('pointerup',190,250);(doc.querySelector('.hp-reveal')as HTMLButtonElement).click();expect(doc.querySelector('.hp-answer')).not.toBeNull();dom.window.close();
 });
});

describe('CSCA subject navigation',()=>{
 it('opens all five complete subject galleries and keeps foundation Chinese separate',async()=>{
  const {dom,doc,click}=await boot();click('nav-stem');
  for(const subject of csca.subjects){
   const expected=csca.words.filter((w:any)=>w.track==='stem'&&w.subjects.includes(subject.id));
   click('deck-stem-subject-'+subject.id);expect(doc.querySelector('h1')?.textContent).toBe(subject.name);
   const select=doc.querySelector('[data-stem-level]')as HTMLSelectElement;expect(select.value).toBe('all');
   expect(select.options[0].textContent).toContain(String(expected.length));
   while(doc.querySelector('[data-action="more"]'))click('more');
   const actual=[...doc.querySelectorAll('.hp-word-tile')].map((b:any)=>b.dataset.action.slice(5));
   expect(new Set(actual)).toEqual(new Set(expected.map((w:any)=>w.id)));expect(actual.length).toBe(expected.length);click('close-deck');
  }
  click('tab-csca');expect(doc.querySelector('.hp-subject-grid')).toBeNull();expect(doc.body.textContent.replace(/[,\s\u202f]/g,'')).toContain('5164');
  click('deck-foundation-all');expect(doc.body.textContent).toContain('5062 entries');dom.window.close();
 });
 it('filters gallery and practice by difficulty and resumes the same queue after reopening',async()=>{
  const {dom,doc,w,click,saved}=await boot();click('nav-stem');click('deck-stem-subject-math');
  const setLevel=(level:string)=>{const select=doc.querySelector('[data-stem-level]')as HTMLSelectElement;select.value=level;select.dispatchEvent(new w.Event('change',{bubbles:true}));};
  for(const level of ['beginner','intermediate','advanced']){
   setLevel(level);const expected=csca.words.filter((w:any)=>w.track==='stem'&&w.subjects.includes('math')&&w.officialRefs.some((r:any)=>r.stage===level));
   expect(doc.querySelector('.hp-counts strong')?.textContent).toBe(String(expected.length));
   expect([...doc.querySelectorAll('.hp-word-tile')].every((b:any)=>expected.some((w:any)=>b.dataset.action==='word-'+w.id))).toBe(true);
   click('start');expect(expected.some((w:any)=>w.h===doc.querySelector('.hp-hanzi')?.textContent)).toBe(true);
   click('reveal');click('incorrect');click('leave');
  }
  click('start');const snapshot=structuredClone(saved.at(-1).state),current=doc.querySelector('.hp-hanzi')?.textContent;
  const resumed=await boot(snapshot);expect(resumed.doc.querySelector('.hp-hanzi')?.textContent).toBe(current);
  expect(snapshot.queues['stem-subject-math:normal:beginner']).toBeDefined();expect(snapshot.queues['stem-subject-math:normal:advanced']).toBeDefined();
  resumed.click('leave');expect((resumed.doc.querySelector('[data-stem-level]')as HTMLSelectElement).value).toBe('advanced');
  resumed.dom.window.close();dom.window.close();
 });
 it('shares learning history and Pocket membership across fields without changing personal records',async()=>{
  const vector=csca.words.find((w:any)=>w.h==='向量'),key='stem:normal:'+vector.id;
  const {dom,doc,click,saved}=await boot({saved:['old-word',vector.id],memberships:{'old-word':['course'],[vector.id]:['course']},progress:{'personal:normal:old-word':{attempts:4,correct:false},[key]:{attempts:3,correct:false}},queues:{'stem-subject-math:normal:all':[vector.id],'stem-subject-physics:normal:all':[vector.id]}});
  click('nav-stem');click('deck-stem-subject-math');expect(doc.querySelectorAll('.hp-counts strong')[2].textContent).toBe('1');click('start');
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('向量');expect((doc.querySelector('[data-action="save-current"]')as HTMLButtonElement).disabled).toBe(true);
  click('reveal');click('correct');click('leave');click('close-deck');click('deck-stem-subject-physics');
  expect(doc.querySelectorAll('.hp-counts strong')[1].textContent).toBe('0');expect(doc.querySelectorAll('.hp-counts strong')[2].textContent).toBe('1');click('start');
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('向量');
  const state=saved.at(-1).state;expect(state.progress[key]).toEqual({attempts:4,correct:true});expect(state.saved).toEqual(['old-word',vector.id]);expect(state.memberships[vector.id]).toEqual(['course']);expect(state.progress['personal:normal:old-word'].attempts).toBe(4);
  dom.window.close();
 });
});
