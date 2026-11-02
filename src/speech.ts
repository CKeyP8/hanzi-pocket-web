import {Capacitor,registerPlugin} from '@capacitor/core';
interface PocketNativePlugin {speak(options:{text:string;slow:boolean}):Promise<void>;stop():Promise<void>;available():Promise<{available:boolean}>;shareFile(options:{contents:string;filename:string}):Promise<{completed:boolean}>}
const nativeSpeech=registerPlugin<PocketNativePlugin>('PocketNative');
export const shareNativeFile=(contents:string,filename:string)=>nativeSpeech.shareFile({contents,filename});
export const isNative=()=>Capacitor.isNativePlatform();
export async function speakChinese(text:string,slow=false){
  if(isNative()){await nativeSpeech.speak({text,slow});return;}
  if(!('speechSynthesis'in window))throw new Error('Pronunciation is unavailable on this device.');
  let voices=speechSynthesis.getVoices();
  if(!voices.length)voices=await new Promise<SpeechSynthesisVoice[]>(resolve=>{
    const done=()=>{clearTimeout(timer);speechSynthesis.removeEventListener('voiceschanged',done);resolve(speechSynthesis.getVoices());};
    const timer=setTimeout(done,1200);speechSynthesis.addEventListener('voiceschanged',done);
  });
  const voice=voices.find(v=>/^zh[-_]CN$/i.test(v.lang)&&v.localService)??voices.find(v=>/^zh/i.test(v.lang)&&v.localService);
  if(!voice)throw new Error('Download a Mandarin voice in iPhone Settings → Accessibility → Spoken Content or Read & Speak → Voices. Then reopen the app.');
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=slow?.55:.85;
  utterance.onerror=()=>window.dispatchEvent(new CustomEvent('pocket-speech-error',{detail:'Audio could not play. Check that a Mandarin voice is downloaded.'}));
  speechSynthesis.speak(utterance);
}
export function stopSpeech(){if(isNative())void nativeSpeech.stop().catch(()=>{});else if('speechSynthesis'in window)speechSynthesis.cancel();}
