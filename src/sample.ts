import type {PocketDB} from './db';
import {saveWord} from './vocabulary';
import {saveGroup} from './groups';
export async function addStarterWords(database:PocketDB){
  await database.transaction('rw',[database.words,database.groups,database.memberships,database.progress,database.preferences],async()=>{
    const groups=await Promise.all(['Daily essentials','Useful verbs','Travel'].map(name=>saveGroup(database,name)));
    const words=[['你好','nǐ hǎo','Hello','0,2'],['学习','xuéxí','To study / To learn','1'],['朋友','péngyou','Friend','0'],['学校','xuéxiào','School','0'],['老师','lǎoshī','Teacher','0'],['喜欢','xǐhuan','To like','1'],['中国','Zhōngguó','China','2'],['明天','míngtiān','Tomorrow','0'],['现在','xiànzài','Now','0'],['工作','gōngzuò','To work / Work','1'],['吃饭','chīfàn','To eat','1,2'],['今天','jīntiān','Today','0'],['谢谢','xièxie','Thank you','0,2'],['再见','zàijiàn','Goodbye','0,2'],['旅行','lǚxíng','To travel / Travel','2']];
    for(const [hanzi,pinyin,meaning,membership] of words)if(!await database.words.where('normalized').equals(hanzi).count())await saveWord(database,{hanzi,pinyin,meaning,groupIds:membership.split(',').map(i=>groups[Number(i)])});
    await database.preferences.update('preferences',{onboarded:true});
  });
}
