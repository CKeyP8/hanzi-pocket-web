(()=>{
 'use strict';
 const shards=new Map();
 async function dataFor(char){
  const shard=char.codePointAt(0)%16;
  if(!shards.has(shard))shards.set(shard,fetch(new URL(`strokes/${shard}.json`,document.baseURI)).then(r=>{if(!r.ok)throw new Error('Reconnect and reopen Strokes to load the stroke pack.');return r.json();}).catch(error=>{shards.delete(shard);throw error;}));
  const data=await shards.get(shard);
  if(!Object.hasOwn(data,char))throw new Error('Stroke order is not included for this character. This pack covers every HSK 1–5 character.');
  return data[char];
 }
 function open({hanzi,pinyin}){
  const chars=[...hanzi].filter(c=>/\p{Script=Han}/u.test(c)),host=document.querySelector('#hp-stem-demo'),previous=document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='hp-modal hp-stroke-modal';dialog.setAttribute('aria-label','Stroke order');
  dialog.innerHTML='<div class="hp-row hp-modal-heading"><h2>Stroke order</h2><button type="button" class="hp-icon" data-stroke-action="close" aria-label="Close stroke order">✕</button></div><p class="hp-small" data-stroke-word></p><div class="hp-group-chips hp-stroke-tabs" aria-label="Characters"></div><div class="hp-stroke-frame"><div class="hp-stroke-target" role="img"></div></div><p class="hp-small" data-stroke-status role="status"></p><div class="hp-stroke-actions"><button type="button" class="hp-secondary" data-stroke-action="replay">Replay</button><button type="button" class="hp-primary" data-stroke-action="next">Next stroke</button><button type="button" class="hp-secondary" data-stroke-action="reset">Reset</button></div><p class="hp-small hp-stroke-note">Each new stroke stays visible. Reset to start again.</p><p class="hp-small">Stroke data: Make Me a Hanzi / Arphic. <a href="./STROKES-LICENSE.txt">License</a>.</p>';
  dialog.querySelector('[data-stroke-word]').textContent=hanzi+' · '+pinyin;
  const target=dialog.querySelector('.hp-stroke-target'),status=dialog.querySelector('[data-stroke-status]'),tabs=dialog.querySelector('.hp-stroke-tabs');
  let writer=null,index=0,step=0,total=0,busy=true,error='',version=0,closed=false;
  const reduced=window.HPAppConfig?.reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for(const [i,char]of chars.entries()){
   const button=document.createElement('button');button.type='button';button.className='hp-chip';button.textContent=char;button.lang='zh-Hans';button.setAttribute('data-stroke-index',i);tabs.append(button);
  }
  function paint(){
   status.textContent=error||(busy?'Drawing…':`${step} / ${total} strokes`);
   status.setAttribute('role',error?'alert':'status');
   for(const button of dialog.querySelectorAll('[data-stroke-action]')){const action=button.dataset.strokeAction;button.disabled=action==='close'?false:busy||Boolean(error)||(action==='next'&&step>=total);}
   for(const [i,button]of [...tabs.children].entries())button.setAttribute('aria-pressed',String(i===index));
  }
  async function load(i){
   const current=++version;writer?.pauseAnimation();writer=null;index=i;step=0;total=0;error='';busy=true;target.replaceChildren();target.setAttribute('aria-label','Stroke order for '+chars[i]);paint();status.textContent='Opening strokes…';
   try{
    if(!chars[i])throw new Error('Choose a word containing Chinese characters to see its stroke order.');
    const data=await dataFor(chars[i]);if(closed||current!==version)return;
    if(!window.HanziWriter)throw new Error('Reconnect and reload the preview to load the stroke player.');
    const colors=getComputedStyle(host),size=Math.min(300,target.clientWidth||280);
    writer=window.HanziWriter.create(target,chars[i],{width:size,height:size,padding:24,showCharacter:false,showOutline:true,strokeColor:colors.getPropertyValue('--hp-ink').trim()||'#202d44',outlineColor:colors.getPropertyValue('--hp-wash').trim()||'#e7e1d7',delayBetweenStrokes:reduced?0:250,strokeAnimationSpeed:reduced?1000:1,strokeFadeDuration:reduced?0:250,charDataLoader:()=>data});
    await writer.getCharacterData();if(closed||current!==version)return;total=data.strokes.length;
   }catch(e){if(!closed&&current===version)error=e.message;}
   finally{if(!closed&&current===version){busy=false;paint();}}
  }
  async function run(action){
   if(busy||error||!writer||(action==='next'&&step>=total))return;
   const current=version,activeWriter=writer;busy=true;paint();
   try{
    if(action==='next'){await activeWriter.animateStroke(step);if(current===version)step++;}
    else if(action==='reset'){await activeWriter.hideCharacter({duration:0});if(current===version)step=0;}
    else if(action==='replay'){await activeWriter.hideCharacter({duration:0});await activeWriter.animateCharacter();if(current===version)step=total;}
   }catch(e){if(current===version)error=e.message;}
   finally{if(!closed&&current===version){busy=false;paint();}}
  }
  function close(){if(closed)return;closed=true;version++;writer?.pauseAnimation();dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();}
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{
   event.stopPropagation();const button=event.target.closest('button');if(!button||button.disabled)return;
   if(button.hasAttribute('data-stroke-index'))void load(Number(button.dataset.strokeIndex));
   else if(button.dataset.strokeAction==='close')close();else if(button.dataset.strokeAction)void run(button.dataset.strokeAction);
  });
  host.append(dialog);dialog.showModal();void load(0);
 }
 window.HanziPocketStrokes={open};
})();
