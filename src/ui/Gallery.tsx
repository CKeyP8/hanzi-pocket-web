import {useMemo,useRef} from 'react';
import {useWindowVirtualizer} from '@tanstack/react-virtual';
import {Check} from 'lucide-react';
import type {Word} from '../model';
export function Gallery({words,columns,onOpen,selected,onSelect,selecting}:{words:Word[];columns:number;onOpen:(id:string)=>void;selected:Set<string>;onSelect:(id:string)=>void;selecting:boolean}){
  const container=useRef<HTMLDivElement>(null);
  const rowCount=Math.ceil(words.length/columns);
  const virtualizer=useWindowVirtualizer({count:rowCount,estimateSize:()=>100,overscan:6,scrollMargin:container.current?.getBoundingClientRect().top!+window.scrollY||0});
  const rows=useMemo(()=>Array.from({length:rowCount},(_,i)=>words.slice(i*columns,(i+1)*columns)),[words,columns,rowCount]);
  const tile=(word:Word)=><button key={word.id} className={`word-tile ${selected.has(word.id)?'selected':''}`} onClick={()=>selecting?onSelect(word.id):onOpen(word.id)} aria-label={selecting?`${selected.has(word.id)?'Deselect':'Select'} ${word.hanzi}`:`Open ${word.hanzi}`} aria-pressed={selecting?selected.has(word.id):undefined}><span lang="zh-Hans">{word.hanzi}</span>{selecting&&<span className="selection-dot" aria-hidden="true">{selected.has(word.id)&&<Check size={12}/>}</span>}</button>;
  if(words.length<=120)return <div ref={container} className="word-grid" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>{words.map(tile)}</div>;
  return <div ref={container} className="virtual-gallery" style={{height:virtualizer.getTotalSize()}}>{virtualizer.getVirtualItems().map(row=><div className="word-grid virtual-row" key={row.key} data-index={row.index} ref={virtualizer.measureElement} style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,transform:`translateY(${row.start-virtualizer.options.scrollMargin}px)`}}>{rows[row.index].map(tile)}</div>)}</div>;
}
