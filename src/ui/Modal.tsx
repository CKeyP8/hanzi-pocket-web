import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current!,previous=document.activeElement;el.showModal();return()=>{el.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
  return <dialog ref={dialog} className="sheet" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=dialog.current!.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}} aria-label={title}>
    <div className="sheet-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div>{children}
  </dialog>;
}
export function Confirm({title,description,label='Confirm',onClose,onConfirm,danger=false}:{title:string;description:string;label?:string;onClose:()=>void;onConfirm:()=>void;danger?:boolean}){
  return <Modal title={title} onClose={onClose}><p className="muted confirmation-copy">{description}</p><div className="button-pair"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" className={`button ${danger?'danger':''}`} onClick={onConfirm}>{label}</button></div></Modal>;
}
