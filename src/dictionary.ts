import {appAsset} from './assets';
export interface Suggestion {pinyin:string;meaning:string}
const marks:Record<string,string[]>={a:['ā','á','ǎ','à'],e:['ē','é','ě','è'],i:['ī','í','ǐ','ì'],o:['ō','ó','ǒ','ò'],u:['ū','ú','ǔ','ù'],'ü':['ǖ','ǘ','ǚ','ǜ']};
export function toneMarks(value:string):string{
  return value.split(/\s+/).map(syllable=>{
    let text=syllable.replace(/u:|v/gi,'ü');const match=text.match(/([0-5])$/);if(!match)return text;
    const tone=Number(match[1]);text=text.slice(0,-1);if(tone===0||tone===5)return text;
    const lower=text.toLowerCase();let index=lower.indexOf('a');if(index<0)index=lower.indexOf('e');if(index<0&&lower.includes('ou'))index=lower.indexOf('o');if(index<0){for(let i=text.length-1;i>=0;i--)if(marks[lower[i]]){index=i;break;}}
    if(index<0)return text;const replacement=marks[lower[index]][tone-1];return text.slice(0,index)+(text[index]===text[index].toUpperCase()?replacement.toUpperCase():replacement)+text.slice(index+1);
  }).join(' ');
}
type Dictionary=Record<string,[string,string][]>;
let loaded:Promise<Dictionary>|null=null;
export async function suggestions(hanzi:string):Promise<Suggestion[]>{
  loaded??=fetch(appAsset('dictionary.json')).then(r=>{if(!r.ok)throw new Error('Dictionary unavailable');return r.json() as Promise<Dictionary>;}).catch(error=>{loaded=null;throw error;});
  const dictionary=await loaded;
  return (Object.hasOwn(dictionary,hanzi.trim())?dictionary[hanzi.trim()]:[]).map(([pinyin,meaning])=>({pinyin:toneMarks(pinyin),meaning}));
}
