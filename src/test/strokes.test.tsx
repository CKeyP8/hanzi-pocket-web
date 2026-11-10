import {readFileSync} from 'node:fs';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {LearnTools} from '../ui/LearnTools';

// Keep animation-frame timestamps on the same clock as the renderer in jsdom.
vi.hoisted(()=>{
  window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),1);
  window.cancelAnimationFrame=handle=>window.clearTimeout(handle);
});

const shards=new Map([...'日月'].map(char=>[char.codePointAt(0)!%16,JSON.parse(readFileSync(`public/strokes/${char.codePointAt(0)!%16}.json`,'utf8'))]));
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>shards.get(Number(url.match(/(\d+)\.json$/)?.[1]))})));
  for(const [name,value]of Object.entries({'--ink':'#202d44','--wash':'#e7e1d7','--navy':'#243a5a'}))document.documentElement.style.setProperty(name,value);
});
afterEach(()=>vi.unstubAllGlobals());

function mainPaths(char:string){
  const target=screen.getByRole('img',{name:`Stroke order for ${char}`});
  const group=target.querySelector('svg > g > g:nth-child(2)') as SVGGElement|null;
  if(!group||group.style.display==='none'||Number(group.style.opacity)===0)return [];
  return [...group.querySelectorAll('path')].filter(path=>Number(path.style.opacity)>0&&Number(path.style.strokeDashoffset)===0);
}
async function open(){
  render(<LearnTools hanzi="日月" pinyin="rì yuè" reduced/>);
  fireEvent.click(screen.getByRole('button',{name:'Strokes'}));
  await waitFor(()=>expect(screen.getByText('0 / 4 strokes')).toBeDefined());
  await waitFor(()=>expect((screen.getByRole('button',{name:'Next stroke'}) as HTMLButtonElement).disabled).toBe(false));
}
async function next(step:number){
  fireEvent.click(screen.getByRole('button',{name:'Next stroke'}));
  await waitFor(()=>expect(screen.getByText(`${step} / 4 strokes`)).toBeDefined());
}
describe('Persistent stroke discovery with the real SVG renderer',()=>{
  it('adds exactly one permanent stroke per tap until the whole character is visible',async()=>{
    await open();expect(mainPaths('日')).toHaveLength(0);
    for(let i=1;i<=4;i++){await next(i);expect(mainPaths('日')).toHaveLength(i);}
    expect((screen.getByRole('button',{name:'Next stroke'}) as HTMLButtonElement).disabled).toBe(true);
    await new Promise(resolve=>setTimeout(resolve,70));expect(mainPaths('日')).toHaveLength(4);
  });
  it('resets the drawing, then starts a fresh sequence; switching characters starts at zero',async()=>{
    await open();await next(1);await next(2);
    fireEvent.click(screen.getByRole('button',{name:'Reset strokes'}));
    await waitFor(()=>expect(screen.getByText('0 / 4 strokes')).toBeDefined());
    await waitFor(()=>expect(mainPaths('日')).toHaveLength(0));
    await next(1);expect(mainPaths('日')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'月'}));
    await waitFor(()=>expect(screen.getByText('0 / 4 strokes')).toBeDefined());
    expect(mainPaths('月')).toHaveLength(0);await next(1);expect(mainPaths('月')).toHaveLength(1);
  });
  it('keeps all strokes after replay and lets reset return to step-by-step discovery',async()=>{
    await open();await next(1);fireEvent.click(screen.getByRole('button',{name:'Replay'}));
    await waitFor(()=>expect(screen.getByText('4 / 4 strokes')).toBeDefined());
    expect(mainPaths('日')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button',{name:'Reset strokes'}));
    await waitFor(()=>expect(mainPaths('日')).toHaveLength(0));await next(1);expect(mainPaths('日')).toHaveLength(1);
  });
});
