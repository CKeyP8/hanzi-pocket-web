import {useEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react';
import {ArrowLeft,ArrowRight,Undo2} from 'lucide-react';
import type {Word} from '../model';
import {LearnTools} from './LearnTools';
import {stopSpeech} from '../speech';
type Props={word:Word;onAnswer:(correct:boolean)=>void;busy?:boolean;reduced?:boolean;resetKey?:string;onExit?:()=>void;onUndo?:()=>void;canUndo?:boolean;title?:string;subtitle?:string;saveControl?:ReactNode};
export function Flashcard({word,onAnswer,busy=false,reduced=false,resetKey='',onExit,onUndo,canUndo=false,title='Hanzi Pocket',subtitle='Personal review',saveControl}:Props){
  const [revealed,setRevealed]=useState(false),[offset,setOffset]=useState(0),[dragging,setDragging]=useState(false),[exiting,setExiting]=useState(false);
  const drag=useRef<{x:number;y:number;horizontal:boolean;pointer:number}|null>(null),clickBlocked=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),answerLock=useRef(false);
  const card=useRef<HTMLButtonElement>(null);
  useEffect(()=>{setRevealed(false);setOffset(0);setExiting(false);setDragging(false);drag.current=null;answerLock.current=false;clearTimeout(timer.current);stopSpeech();},[word.id,resetKey]);
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;clearTimeout(timer.current);stopSpeech();};},[]);
  const reveal=()=>{if(!busy&&!exiting&&Date.now()>=clickBlocked.current){setRevealed(true);card.current?.focus({preventScroll:true});}};
  const answer=(correct:boolean)=>{
    if(!revealed||busy||answerLock.current)return;answerLock.current=true;stopSpeech();setExiting(true);setOffset(correct?-window.innerWidth:window.innerWidth);
    timer.current=setTimeout(()=>{onAnswer(correct);setExiting(false);setOffset(0);setRevealed(false);answerLock.current=false;},reduced?0:170);
  };
  const down=(event:PointerEvent)=>{
    if(!revealed||busy||exiting||event.button!==0)return;
    const target=event.target as HTMLElement;
    if(target.closest('a,input,select,textarea,dialog,[data-gesture-ignore]')||target.closest('button:not([data-reveal])'))return;
    drag.current={x:event.clientX,y:event.clientY,horizontal:false,pointer:event.pointerId};
  };
  const move=(event:PointerEvent)=>{
    const current=drag.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.x,dy=event.clientY-current.y;
    if(!current.horizontal&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){drag.current=null;return;}
    if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){current.horizontal=true;event.currentTarget.setPointerCapture?.(event.pointerId);}
    if(current.horizontal){setDragging(true);setOffset(dx);clickBlocked.current=Date.now()+600;}
  };
  const end=(event:PointerEvent,cancel=false)=>{
    const current=drag.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.x;drag.current=null;setDragging(false);
    if(current.horizontal)clickBlocked.current=Date.now()+400;
    if(!cancel&&current.horizontal&&Math.abs(dx)>85)answer(dx<0);else setOffset(0);
  };
  return <section className={`study-canvas ${offset< -25?'answer-correct':offset>25?'answer-incorrect':''}`} aria-label="Flashcard review" onPointerDown={down} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onClick={e=>{if(!(e.target as HTMLElement).closest('button,a,input,dialog,[data-gesture-ignore]'))reveal();}}>
    <header className="study-header"><button className="icon-button" aria-label="Leave review" onClick={onExit} disabled={busy||exiting}><ArrowLeft size={20}/></button><div><span>{title}</span><small>{subtitle}</small></div><div className="study-save">{saveControl}</div></header>
    <div className="study-body">
      <button ref={card} data-reveal className={`flashcard editorial-card ${dragging?'dragging':''}`} style={{transform:`translateX(${offset}px) rotate(${offset/32}deg)`}} disabled={busy||exiting} onClick={reveal} aria-label={revealed?`${word.hanzi}, ${word.pinyin}, ${word.meaning}`:`${word.hanzi}. Reveal pronunciation and meaning`}>
        <span className={`hanzi ${[...word.hanzi].length>4?'long-hanzi':''}`} lang="zh-Hans">{word.hanzi}</span>
        {revealed&&<span className="answer-details"><span className="pinyin">{word.pinyin}</span><span className="meaning">{word.meaning}</span></span>}
      </button>
      {revealed&&<LearnTools key={word.id} hanzi={word.hanzi} pinyin={word.pinyin} reduced={reduced}/>}
    </div>
    <footer className="study-footer"><p className="review-hint" aria-live="polite">{revealed?'Swipe left if correct · right to revisit':'Tap anywhere to reveal the answer'}</p><div className="study-answer-buttons"><button className="correct-answer" disabled={!revealed||busy||exiting} onClick={()=>answer(true)}><ArrowLeft size={18}/>Correct</button><button className="study-undo" aria-label="Undo last swipe" disabled={busy||exiting||!canUndo} onClick={onUndo}><Undo2 size={17}/><span>Undo</span></button><button className="incorrect-answer" disabled={!revealed||busy||exiting} onClick={()=>answer(false)}>Incorrect<ArrowRight size={18}/></button></div></footer>
  </section>;
}
