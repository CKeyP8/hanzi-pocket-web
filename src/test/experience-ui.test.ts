import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,it,expect,vi} from 'vitest';
import {ExperienceDB,openExperience} from '../experience-storage';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function boot(initial:Record<string,unknown>={},overrides:Record<string,unknown>={}){
 const dom=new JSDOM('<div id="hp-stem-demo"><div data-demo-app></div></div>',{url:'https://ckeyp8.github.io/hanzi-pocket-web/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,doc=w.document;
 Object.assign(w,{structuredClone,confirm:()=>true});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const saved:any[]=[];w.fetch=async(url:any)=>({ok:true,json:async()=>JSON.parse(readFileSync('public/'+new URL(url).pathname.split('/').at(-1),'utf8'))})as any;
 (w as any).HPAppConfig={production:true,version:'3.1',offlineReady:true,initialPayload:{format:'hanzi-pocket',version:3,state:{panel:'review',mode:'normal',saved:['old-word'],customWords:[{id:'old-word',h:'量子计算',p:'liàngzǐ jìsuàn',m:'my own definition',source:'personal'}],groups:[{id:'course',name:'My course'}],memberships:{'old-word':['course']},progress:{'personal:normal:old-word':{attempts:4,correct:false}},queues:{},...initial}},save:async(value:any)=>{saved.push(structuredClone(value));},lookup:async()=>[{pinyin:'liàngzǐ jìsuàn',meaning:'quantum computing'}],...overrides};
 w.eval(readFileSync('public/pocket-quiz.js','utf8'));w.eval(readFileSync('public/pocket-app.js','utf8'));
 for(let i=0;i<100&&!doc.querySelector('.hp-nav,.hp-study');i++)await new Promise(r=>setTimeout(r,5));
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

describe('Confirmed word and collection saves',()=>{
 it.each([['nav-hsk','deck-hsk-1'],['nav-stem','deck-stem-subject-math']])('saves collection selections with the bookmark button from %s and retains them after reopening',async(panel,category)=>{
  const database=new ExperienceDB('confirmed-save-'+crypto.randomUUID());let first:any,second:any;
  try{
   const initial={panel:'review',saved:[],customWords:[],groups:[{id:'course',name:'My course'}],memberships:{},progress:{},queues:{}};
   await database.state.put({id:'active',revision:1,payload:{format:'hanzi-pocket',version:3,state:initial}});
   const store=await openExperience(database,async()=>{throw new Error('Must not migrate existing data');},[]);
   first=await boot(store.initial.state,{save:store.save});const {doc,click}=first;
   click(panel);click(category);const id=(doc.querySelector('.hp-word-tile')as HTMLElement).dataset.action!.slice(5);click('word-'+id);
   (doc.querySelector('[name="groups"][value="course"]')as HTMLInputElement).checked=true;click('save-'+id);
   await vi.waitFor(()=>expect(doc.querySelector('[data-demo-app]')?.hasAttribute('aria-busy')).toBe(false));
   expect((doc.querySelector('[name="groups"]')as HTMLInputElement).checked).toBe(true);
   const stored=(await database.state.get('active'))!.payload.state as any;expect(stored.saved).toContain(id);expect(stored.memberships[id]).toEqual(['course']);
   first.dom.window.close();first=null;const reopened=await openExperience(database,async()=>{throw new Error('Must not migrate');},[]);
   second=await boot(reopened.initial.state,{save:reopened.save});second.click('nav-pocket');second.click('group-course');expect(second.doc.querySelector('[data-action="word-'+id+'"]')).not.toBeNull();await reopened.flush();
  }finally{first?.dom.window.close();second?.dom.window.close();await database.delete();}
 });
 it('keeps a new word and checked collections in the form until a write succeeds, and supports retry without duplicates',async()=>{
  const {dom,w,doc,click,saved}=await boot();try{
   click('nav-pocket');click('new-word');const form=doc.querySelector('form[data-form="word"]')as HTMLFormElement;
   (form.elements.namedItem('hanzi')as HTMLInputElement).value='样例词';(form.elements.namedItem('pinyin')as HTMLInputElement).value='yànglì cí';(form.elements.namedItem('meaning')as HTMLTextAreaElement).value='example word';(form.querySelector('[name="groups"]')as HTMLInputElement).checked=true;
   let rejectWrite!:(reason:Error)=>void;const pending=vi.fn(()=>new Promise<void>((_,reject)=>{rejectWrite=reject;}));(w as any).HPAppConfig.save=pending;
   const submit=()=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();submit();
   expect(pending).toHaveBeenCalledTimes(1);expect(doc.querySelector('dialog')).not.toBeNull();expect(doc.querySelector('[data-form-error]')?.textContent).toBe('Saving…');expect(doc.querySelector('.hp-toaster')?.textContent??'').not.toContain('Word saved');
   rejectWrite(new Error('Storage temporarily unavailable'));await vi.waitFor(()=>expect(doc.querySelector('[data-form-error]')?.textContent).toContain('Try saving again'));
   expect(form.isConnected).toBe(true);expect((form.elements.namedItem('hanzi')as HTMLInputElement).value).toBe('样例词');expect((form.querySelector('[name="groups"]')as HTMLInputElement).checked).toBe(true);
   (w as any).HPAppConfig.save=async(value:any)=>saved.push(structuredClone(value));submit();await vi.waitFor(()=>expect(doc.querySelector('dialog')).toBeNull());
   const stored=saved.at(-1).state,newWords=stored.customWords.filter((word:any)=>word.h==='样例词');expect(newWords).toHaveLength(1);expect(stored.memberships[newWords[0].id]).toEqual(['course']);expect(stored.progress['personal:normal:old-word'].attempts).toBe(4);
  }finally{dom.window.close();}
 });
 it('does not overwrite a saved personal word when its edit fails',async()=>{
  const {dom,w,doc,click,saved}=await boot();try{
   click('nav-pocket');click('word-old-word');click('edit-word-old-word');const form=doc.querySelector('form')as HTMLFormElement;(form.elements.namedItem('meaning')as HTMLTextAreaElement).value='changed definition';
   (w as any).HPAppConfig.save=async()=>{throw new Error('Write failed');};form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(doc.querySelector('[data-form-error]')?.textContent).toContain('Write failed'));
   expect((form.elements.namedItem('meaning')as HTMLTextAreaElement).value).toBe('changed definition');(w as any).HPAppConfig.save=async(value:any)=>saved.push(structuredClone(value));click('close-modal');click('word-old-word');expect(doc.querySelector('dialog')?.textContent).toContain('my own definition');
  }finally{dom.window.close();}
 });
});

describe('Visible update prompts',()=>{
 it('prompts on entry, supports Later, and keeps the Settings update action available',async()=>{
  const {dom,doc,click}=await boot({}, {needsUpdate:true,update:async()=>{}});try{expect(doc.querySelector('[data-update-notice]')?.textContent).toContain('An update is available');click('update-later');expect(doc.querySelector('[data-update-notice]')).toBeNull();click('settings');expect(doc.querySelector('[data-action="install-update"]')).not.toBeNull();}finally{dom.window.close();}
 });
 it('does not rebuild an open word form when update availability changes, and prompts after leaving it',async()=>{
  const {dom,w,doc,click}=await boot();try{click('nav-pocket');click('new-word');const field=doc.querySelector('[name="hanzi"]')as HTMLInputElement;field.value='保留';(w as any).HPAppConfig.needsUpdate=true;w.dispatchEvent(new w.Event('pocket-status'));expect(doc.querySelector('[name="hanzi"]')).toBe(field);expect(field.value).toBe('保留');expect(doc.querySelector('[data-update-notice]')).toBeNull();click('close-modal');expect(doc.querySelector('[data-update-notice]')).not.toBeNull();}finally{dom.window.close();}
 });
 it('reports installation errors and allows another attempt',async()=>{
  const update=vi.fn(async()=>{throw new Error('Reconnect to update');}),{dom,doc,click}=await boot({}, {needsUpdate:true,update});try{click('install-update');await vi.waitFor(()=>expect(doc.querySelector('.hp-toaster')?.textContent).toContain('Reconnect to update'));expect(update).toHaveBeenCalledTimes(1);expect((doc.querySelector('[data-action="install-update"]')as HTMLButtonElement).disabled).toBe(false);}finally{dom.window.close();}
 });
});

const csca=JSON.parse(readFileSync('public/csca-catalog.json','utf8'));
const hsk=JSON.parse(readFileSync('public/hsk-catalog.json','utf8'));
function search(context:any,value:string){const input=context.doc.querySelector('.hp-search input')as HTMLInputElement;input.value=value;input.dispatchEvent(new context.w.Event('input',{bubbles:true}));}
const galleryWordIds=(doc:Document)=>[...doc.querySelectorAll('.hp-word-tile')].map((b:any)=>b.dataset.action.slice(5));

describe('Search across HSK levels',()=>{
 it('finds words across all levels and identifies each result level',async()=>{
  const context=await boot(),{dom,doc,click}=context;click('nav-hsk');
  expect(doc.querySelector('[aria-label="Search all HSK levels"]')).not.toBeNull();
  expect(doc.querySelectorAll('.hp-word-tile')).toHaveLength(0);search(context,'学');
  while(doc.querySelector('[data-action="more"]'))click('more');
  const expected=hsk.filter((w:any)=>(w.hanzi+' '+w.meaning).includes('学'));
  expect(new Set(galleryWordIds(doc))).toEqual(new Set(expected.map((w:any)=>w.id)));
  expect(new Set(expected.map((w:any)=>w.level)).size).toBeGreaterThan(1);
  for(const tile of doc.querySelectorAll('.hp-word-tile')){const word=hsk.find((w:any)=>'word-'+w.id===(tile as HTMLElement).dataset.action);expect(tile.textContent).toContain('HSK '+word.level);}
  dom.window.close();
 });
 it('searches pinyin without tones and English meanings and clears safely',async()=>{
  const context=await boot(),{dom,doc,click}=context;click('nav-hsk');search(context,'pengyou');
  expect([...doc.querySelectorAll('.hp-word-tile span[lang]')].some(e=>e.textContent==='朋友')).toBe(true);
  search(context,'friend');expect(doc.querySelectorAll('.hp-word-tile').length).toBeGreaterThan(0);
  search(context,'no-such-word-98374');expect(doc.querySelectorAll('.hp-word-tile')).toHaveLength(0);expect(doc.body.textContent).toContain('No words match');
  search(context,'');expect(doc.querySelectorAll('.hp-word-tile')).toHaveLength(0);expect(doc.querySelector('[data-action="deck-hsk-5"]')).not.toBeNull();dom.window.close();
 });
 it('keeps per-level search scoped and global results usable for saving',async()=>{
  const context=await boot(),{dom,doc,click,saved}=context;click('nav-hsk');click('deck-hsk-1');search(context,'学');
  expect(new Set(galleryWordIds(doc))).toEqual(new Set(hsk.filter((w:any)=>w.level===1&&w.hanzi.includes('学')).map((w:any)=>w.id)));
  click('close-deck');search(context,'朋友');const id=galleryWordIds(doc)[0];click('word-'+id);click('save-'+id);
  expect(saved.at(-1).state.saved).toContain(id);await vi.waitFor(()=>expect(doc.querySelector('[data-demo-app]')?.hasAttribute('aria-busy')).toBe(false));dom.window.close();
 });
});

const characterEntries:Record<string,{pinyin:string;meaning:string}[]>={
 '学':[{pinyin:'xué',meaning:'to learn; to study'}],'校':[{pinyin:'jiào',meaning:'to check'},{pinyin:'xiào',meaning:'school'}],
 '朋':[{pinyin:'péng',meaning:'friend'}],'友':[{pinyin:'yǒu',meaning:'friend'}]
};
const characterLookup=async(h:string)=>characterEntries[h]??[];
const characterInitial={panel:'pocket',activeGroup:'course',saved:['school','friend','repeat','outside'],customWords:[
 {id:'school',h:'学校',p:'xuéxiào',m:'school',source:'personal'},
 {id:'friend',h:'朋友',p:'péngyou',m:'friend',source:'personal'},
 {id:'repeat',h:'A学·友2',p:'xué yǒu',m:'classmate',source:'personal'},
 {id:'outside',h:'火',p:'huǒ',m:'fire',source:'personal'}
],memberships:{school:['course'],friend:['course'],repeat:['course']},progress:{},queues:{}};
async function characterStudy(initial:Record<string,unknown>={}){
 const context=await boot({...characterInitial,...initial},{lookup:characterLookup});context.w.Math.random=()=>0;
 context.click('flashcards-characters');context.click('start-group-course');
 for(let i=0;i<200&&!context.doc.querySelector('.hp-study');i++)await new Promise(r=>setTimeout(r,5));
 expect(context.doc.querySelector('.hp-study')).not.toBeNull();return context;
}
describe('Individual-character flashcards',()=>{
 it('shuffles only distinct Chinese characters from the chosen category',async()=>{
  const {dom,doc,click,saved}=await characterStudy(),ids=saved.at(-1).state.queues['group:course:characters'];
  expect(new Set(ids)).toEqual(new Set(['学','校','朋','友'].map(c=>'character-'+c)));expect(ids).toHaveLength(4);
  expect(ids).not.toEqual(['学','校','朋','友'].map(c=>'character-'+c));
  const seen=[];for(let i=0;i<4;i++){seen.push(doc.querySelector('.hp-hanzi')!.textContent);click('reveal');click('correct');}
  expect(new Set(seen)).toEqual(new Set(['学','校','朋','友']));expect(seen.every(c=>[...c!].length===1)).toBe(true);dom.window.close();
 });
 it('reveals character readings and meanings, shows source context, and saves the source word',async()=>{
  const {dom,doc,click,saved}=await characterStudy({saved:['school'],memberships:{school:['course']},queues:{'group:course:characters':['character-校','character-学']}});
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('校');expect(doc.querySelector('.hp-pinyin')).toBeNull();click('reveal');
  expect(doc.querySelector('.hp-pinyin')?.textContent).toContain('xiào');expect(doc.querySelector('.hp-pinyin')?.textContent).toContain('jiào');
  expect(doc.querySelector('.hp-meaning')?.textContent).toContain('to check');click('reveal');
  expect(doc.querySelector('dialog')?.textContent).toContain('学校');expect(doc.querySelector('dialog')?.textContent).toContain('Source word');
  expect(doc.querySelector('[data-action="save-school"]')).not.toBeNull();expect(saved.at(-1).state.saved).not.toContain('character-校');dom.window.close();
 });
 it('keeps word progress separate, supports Undo, and resumes the exact remaining queue',async()=>{
  const existing={'personal:normal:school':{attempts:7,correct:true}},context=await characterStudy({progress:existing}),{dom,doc,click,saved}=context;
  const first=doc.querySelector('.hp-hanzi')!.textContent,queue=[...saved.at(-1).state.queues['group:course:characters']];click('reveal');click('incorrect');
  expect(saved.at(-1).state.progress['character:characters:character-'+first]).toEqual({attempts:1,correct:false});
  expect(saved.at(-1).state.progress['personal:normal:school']).toEqual(existing['personal:normal:school']);
  click('undo');expect(doc.querySelector('.hp-hanzi')?.textContent).toBe(first);expect(saved.at(-1).state.queues['group:course:characters']).toEqual(queue);
  expect(saved.at(-1).state.progress['character:characters:character-'+first]).toBeUndefined();click('reveal');click('correct');
  const snapshot=structuredClone(saved.at(-1).state),next=doc.querySelector('.hp-hanzi')?.textContent;
  const resumed=await boot(snapshot,{lookup:characterLookup});expect(resumed.doc.querySelector('.hp-hanzi')?.textContent).toBe(next);
  resumed.click('reveal');expect(resumed.doc.querySelector('.hp-pinyin')?.textContent).not.toBe('');
  expect(resumed.w.HPAppConfig.initialPayload.state.queues['group:course:characters']).toEqual(snapshot.queues['group:course:characters']);
  resumed.dom.window.close();dom.window.close();
 });
 it('returns to classic whole-word cards and preserves the character preference across Dictation',async()=>{
  const {dom,doc,click,saved}=await characterStudy();click('leave');click('mode-dictation');
  expect(doc.querySelector('[aria-label="Flashcard mode"]')).toBeNull();click('mode-normal');
  expect(doc.querySelector('[data-action="flashcards-characters"]')?.getAttribute('aria-pressed')).toBe('true');
  click('flashcards-classic');click('start-group-course');expect(['学校','朋友','A学·友2']).toContain(doc.querySelector('.hp-hanzi')?.textContent);
  expect(saved.at(-1).state.queues['group:course:normal']).toHaveLength(3);dom.window.close();
 });
 it('uses only the selected HSK level or STEM difficulty in character mode',async()=>{
  const {dom,doc,w,click,saved}=await boot({}, {lookup:characterLookup});click('nav-hsk');click('deck-hsk-2');click('flashcards-characters');click('start');
  for(let i=0;i<200&&!doc.querySelector('.hp-study');i++)await new Promise(r=>setTimeout(r,5));
  const expected=new Set(hsk.filter((v:any)=>v.level===2).flatMap((v:any)=>[...v.hanzi].filter((c:string)=>/\p{Script=Han}/u.test(c))).map((c:string)=>'character-'+c));
  expect(new Set(saved.at(-1).state.queues['hsk-2:characters'])).toEqual(expected);click('leave');click('nav-stem');click('deck-stem-subject-math');
  const select=doc.querySelector('[data-stem-level]')as HTMLSelectElement;select.value='beginner';select.dispatchEvent(new w.Event('change',{bubbles:true}));click('start');
  for(let i=0;i<200&&!doc.querySelector('.hp-study');i++)await new Promise(r=>setTimeout(r,5));
  const stemChars=new Set(csca.words.filter((v:any)=>v.track==='stem'&&v.subjects.includes('math')&&v.officialRefs.some((r:any)=>r.stage==='beginner')).flatMap((v:any)=>[...v.h].filter((c:string)=>/\p{Script=Han}/u.test(c))).map((c:string)=>'character-'+c));
  expect(new Set(saved.at(-1).state.queues['stem-subject-math:characters:beginner'])).toEqual(stemChars);dom.window.close();
 });
 it('allows navigation while the dictionary loads and does not start stale practice',async()=>{
  let release!:(value:any)=>void;const dictionary=new Promise(resolve=>{release=resolve;});
  const {dom,doc,click}=await boot(characterInitial,{lookup:()=>dictionary});click('flashcards-characters');click('start-group-course');
  expect(doc.body.textContent).toContain('Preparing character');click('nav-hsk');release([]);await new Promise(r=>setTimeout(r,20));
  expect(doc.querySelector('.hp-study')).toBeNull();expect(doc.querySelector('[aria-label="Search all HSK levels"]')).not.toBeNull();dom.window.close();
 });
 it('retains touch swipes and source-word collection actions for a single-character card',async()=>{
  const {dom,doc,w,click,saved}=await characterStudy(),first=doc.querySelector('.hp-hanzi')!.textContent;
  click('reveal');click('organize-current');expect(doc.querySelector('dialog')?.textContent).toContain('Organize 1 words');
  const box=doc.querySelector('[name="groups"]')as HTMLInputElement;box.checked=true;doc.querySelector('form')!.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(doc.querySelector('dialog')).toBeNull());
  expect(saved.at(-1).state.saved.every((id:string)=>!id.startsWith('character-'))).toBe(true);
  const app=doc.querySelector('[data-demo-app]')!,child=doc.querySelector('.hp-hanzi')!;
  const pointer=(type:string,x:number,target:Element)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:250});Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},pointerType:{value:'touch'}});target.dispatchEvent(event);};
  pointer('pointerdown',190,child);pointer('pointermove',160,child);pointer('lostpointercapture',160,child);pointer('pointermove',70,app);pointer('pointerup',70,app);
  expect(saved.at(-1).state.progress['character:characters:character-'+first]).toEqual({attempts:1,correct:true});expect(doc.querySelector('.hp-hanzi')?.textContent).not.toBe(first);dom.window.close();
 });
 it('reports dictionary failure without losing word progress or blocking Classic practice',async()=>{
  const original={'personal:normal:school':{attempts:3,correct:true}},context=await boot({...characterInitial,progress:original},{lookup:async()=>{throw new Error('Dictionary unavailable');}}),{dom,doc,click,saved}=context;
  click('flashcards-characters');click('start-group-course');await new Promise(r=>setTimeout(r,20));
  expect(doc.body.textContent).toContain('Dictionary unavailable');expect(doc.querySelector('.hp-study')).toBeNull();click('flashcards-classic');click('start-group-course');
  expect(['学校','朋友','A学·友2']).toContain(doc.querySelector('.hp-hanzi')?.textContent);expect(saved.at(-1).state.progress).toEqual(original);dom.window.close();
 });
 it('does not start stale practice after changing STEM difficulty during dictionary loading',async()=>{
  let release!:(value:any)=>void;const dictionary=new Promise(resolve=>{release=resolve;});
  const {dom,doc,w,click}=await boot({}, {lookup:()=>dictionary});click('nav-stem');click('deck-stem-subject-math');click('flashcards-characters');click('start');
  const select=doc.querySelector('[data-stem-level]')as HTMLSelectElement;select.value='advanced';select.dispatchEvent(new w.Event('change',{bubbles:true}));release([]);await new Promise(r=>setTimeout(r,20));
  expect(doc.querySelector('.hp-study')).toBeNull();expect((doc.querySelector('[data-stem-level]')as HTMLSelectElement).value).toBe('advanced');dom.window.close();
 });
});

async function gestureStudy(revealed=true){
 const context=await boot({panel:'hsk',deck:'hsk-1',study:true,revealed,queues:{'hsk-1:normal':['hsk2026-1','hsk2026-2','hsk2026-3']}});
 const {doc,w}=context,app=doc.querySelector('[data-demo-app]')as HTMLElement,captures:number[]=[],releases:number[]=[];
 (app as any).setPointerCapture=(id:number)=>captures.push(id);(app as any).releasePointerCapture=(id:number)=>releases.push(id);
 const pointer=(type:string,x:number,y:number,id=1,primary=true,target?:Element)=>{
  const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
  Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:primary},pointerType:{value:'touch'}});
  (target??doc.querySelector('.hp-reveal')??app).dispatchEvent(event);
 };
 return {...context,app,pointer,captures,releases};
}
describe('Horizontal practice gestures',()=>{
 it('blocks swipes while a bookmark write is pending, then resumes practice without losing progress',async()=>{
  const {dom,w,doc,click,pointer,saved}=await gestureStudy();try{
   let finishWrite!:()=>void;let pending:any;(w as any).HPAppConfig.save=(value:any)=>{pending=structuredClone(value);return new Promise<void>(resolve=>{finishWrite=resolve;});};
   const first=doc.querySelector('.hp-hanzi')?.textContent;click('save-current');pointer('pointerdown',190,250);pointer('pointermove',80,250);pointer('pointerup',80,250);expect(doc.querySelector('.hp-hanzi')?.textContent).toBe(first);expect(pending.state.progress['hsk:normal:hsk2026-1']).toBeUndefined();
   finishWrite();await vi.waitFor(()=>expect(doc.querySelector('[data-demo-app]')?.hasAttribute('aria-busy')).toBe(false));(w as any).HPAppConfig.save=async(value:any)=>saved.push(structuredClone(value));pointer('pointerdown',190,250);pointer('pointermove',80,250);pointer('pointerup',80,250);expect(saved.at(-1).state.progress['hsk:normal:hsk2026-1']).toEqual({attempts:1,correct:true});
  }finally{dom.window.close();}
 });
 it.each([{dx:-110,correct:true},{dx:110,correct:false}])('ignores initial vertical drift before a horizontal swipe ($correct)',async({dx,correct})=>{
  const {dom,doc,pointer,saved,captures}=await gestureStudy();
  pointer('pointerdown',190,250);pointer('pointermove',192,284);pointer('pointermove',190+dx,292);
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe(`translateX(${dx}px)`);
  pointer('pointerup',190+dx,292);pointer('pointerup',190+dx,292);
  expect(saved.at(-1).state.progress['hsk:normal:hsk2026-1']).toEqual({attempts:1,correct});
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('八');expect(captures).toEqual([1]);dom.window.close();
 });
 it.each([
  {dx:-110,correct:true,origin:'.hp-reveal'},
  {dx:110,correct:false,origin:'.hp-reveal'},
  {dx:-110,correct:true,origin:'.hp-hanzi'},
  {dx:110,correct:false,origin:'.hp-hanzi'},
  {dx:-110,correct:true,origin:'.hp-study-body'},
  {dx:110,correct:false,origin:'.hp-study-body'}
 ])('keeps a touch swipe when implicit capture transfers from $origin ($correct)',async({dx,correct,origin})=>{
  const {dom,doc,app,pointer,saved,captures,releases}=await gestureStudy(),start=doc.querySelector(origin)!;
  // Touch implicitly captures the element pressed. On explicit capture by the
  // app, the old element loses capture first; that event bubbles to the app.
  pointer('pointerdown',190,250,1,true,start);pointer('gotpointercapture',190,250,1,true,start);
  pointer('pointermove',190+Math.sign(dx)*20,270,1,true,start);
  pointer('lostpointercapture',190+Math.sign(dx)*20,270,1,true,start);
  pointer('gotpointercapture',190+Math.sign(dx)*20,270,1,true,app);
  expect(releases).toEqual([]);
  pointer('pointermove',190+dx,280,1,true,app);
  expect((doc.querySelector('.hp-reveal')as HTMLElement).style.transform).toBe(`translateX(${dx}px)`);
  pointer('pointerup',190+dx,280,1,true,app);
  expect(saved.at(-1)?.state.progress['hsk:normal:hsk2026-1']).toEqual({attempts:1,correct});
  expect(doc.querySelector('.hp-hanzi')?.textContent).toBe('八');expect(captures).toEqual([1]);expect(releases).toEqual([1]);dom.window.close();
 });
 it.each([-100,100])('keeps a quick touch flick when capture transfers just before finger-up (%s)',async dx=>{
  const {dom,doc,app,pointer,saved}=await gestureStudy(),start=doc.querySelector('.hp-reveal')!;
  pointer('pointerdown',190,250,1,true,start);pointer('pointermove',190+dx,255,1,true,start);
  pointer('lostpointercapture',190+dx,255,1,true,start);pointer('gotpointercapture',190+dx,255,1,true,app);pointer('pointerup',190+dx,255,1,true,app);
  expect(saved.at(-1)?.state.progress['hsk:normal:hsk2026-1']).toEqual({attempts:1,correct:dx<0});dom.window.close();
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
  const {dom,doc,pointer,saved}=await gestureStudy();pointer('pointerdown',190,250);pointer('pointermove',150,260);pointer(event,150,260,1,true,doc.querySelector('[data-demo-app]')!);pointer('pointerup',80,260);
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
