(function(scope){
 'use strict';
 const choose=(list,rng)=>list[Math.floor(rng()*list.length)];
 const integer=(min,max,rng)=>min+Math.floor(rng()*(max-min+1));
 const small=['零','一','二','三','四','五','六','七','八','九'],tones=['líng','yī','èr','sān','sì','wǔ','liù','qī','bā','jiǔ'];
 function numeral(n){if(n<10)return {h:small[n],p:tones[n]};if(n===100)return {h:'一百',p:'yībǎi'};const ten=Math.floor(n/10),unit=n%10;return {h:(ten===1?'':small[ten])+'十'+(unit?small[unit]:''),p:(ten===1?'':tones[ten])+'shí'+(unit?tones[unit]:'')};}
 const actor=[['我','wǒ','I','am'],['你','nǐ','You','are'],['我们','wǒmen','We','are'],['他们','tāmen','They','are'],['老师','lǎoshī','The teacher','is']];
 const things=[['本书','běn shū','books'],['杯茶','bēi chá','cups of tea'],['瓶水','píng shuǐ','bottles of water'],['个苹果','gè píngguǒ','apples'],['支笔','zhī bǐ','pens'],['张票','zhāng piào','tickets']];
 const activities=[['图书馆看书','túshūguǎn kàn shū','reading in the library'],['餐厅吃饭','cāntīng chī fàn','eating in the restaurant'],['家里学中文','jiālǐ xué Zhōngwén','studying Chinese at home'],['公园跑步','gōngyuán pǎo bù','running in the park'],['教室上课','jiàoshì shàng kè','attending a lesson in the classroom'],['商店买东西','shāngdiàn mǎi dōngxi','shopping in the store']];
 const times=[['明天上午','míngtiān shàngwǔ','tomorrow morning',[8,9,10,11]],['明天下午','míngtiān xiàwǔ','tomorrow afternoon',[1,2,3,4,5]],['今天上午','jīntiān shàngwǔ','this morning',[8,9,10,11]],['今天下午','jīntiān xiàwǔ','this afternoon',[1,2,3,4,5]]];
 const transports=[['地铁','dìtiě','metro'],['公共汽车','gōnggòng qìchē','bus'],['出租车','chūzūchē','taxi']];
 const destinations=[['学校','xuéxiào','school'],['机场','jīchǎng','the airport'],['公司','gōngsī','the office'],['医院','yīyuàn','the hospital']];
 const families={
  everyday:[
   rng=>{const a=choose(actor,rng),item=choose(things,rng),n=choose([2,3,4,5,6,7,8,9],rng),q=n===2?{h:'两',p:'liǎng'}:numeral(n);return {text:`${a[0]}今天买了${q.h}${item[0]}。`,pinyin:`${a[1]} jīntiān mǎi le ${q.p} ${item[1]}.`,answer:`${a[2]} bought ${n} ${item[2]} today.`,facts:{quantity:n}};},
   rng=>{const a=choose(actor,rng),activity=choose(activities,rng);return {text:`${a[0]}现在在${activity[0]}。`,pinyin:`${a[1]} xiànzài zài ${activity[1]}.`,answer:`${a[2]} ${a[3]} ${activity[2]} now.`};},
   rng=>{const a=choose(actor,rng),time=choose(times,rng),n=choose(time[3],rng),q=numeral(n);return {text:`${a[0]}${time[0]}${q.h}点去上课。`,pinyin:`${a[1]} ${time[1]} ${q.p} diǎn qù shàng kè.`,answer:`${a[2]} will go to class ${time[2]} at ${n} o’clock.`,facts:{hour:n,period:time[0].includes('上午')?'morning':'afternoon'}};},
   rng=>{const t=choose(transports,rng),d=choose(destinations,rng),n=choose([10,15,20,25,30,35,40,45,50],rng),q=numeral(n);return {text:`坐${t[0]}去${d[0]}需要${q.h}分钟。`,pinyin:`zuò ${t[1]} qù ${d[1]} xūyào ${q.p} fēnzhōng.`,answer:`It takes ${n} minutes to get to ${d[2]} by ${t[2]}.`,facts:{minutes:n}};}
  ],
  stem:[
   rng=>{const start=integer(0,50,rng),delta=integer(1,30,rng),end=start+delta,a=numeral(start),b=numeral(end);return {text:`实验中，温度从${a.h}摄氏度升高到${b.h}摄氏度。`,pinyin:`shíyàn zhōng, wēndù cóng ${a.p} shèshìdù shēnggāo dào ${b.p} shèshìdù.`,answer:`During the experiment, the temperature rose from ${start}°C to ${end}°C.`,facts:{start,end,direction:'increase'}};},
   rng=>{const start=integer(2,30,rng),end=integer(1,start-1,rng),a=numeral(start),b=numeral(end);return {text:`电路中的电流从${a.h}安培减小到${b.h}安培。`,pinyin:`diànlù zhōng de diànliú cóng ${a.p} ānpéi jiǎnxiǎo dào ${b.p} ānpéi.`,answer:`The current in the circuit decreased from ${start} amperes to ${end} ${end===1?'ampere':'amperes'}.`,facts:{start,end,direction:'decrease'}};},
   rng=>{const volume=integer(1,10,rng),density=integer(1,10,rng),mass=volume*density,a=numeral(mass),b=numeral(volume),c=numeral(density);return {text:`样品的质量是${a.h}克，体积是${b.h}立方厘米，所以密度是${c.h}克每立方厘米。`,pinyin:`yàngpǐn de zhìliàng shì ${a.p} kè, tǐjī shì ${b.p} lìfāng límǐ, suǒyǐ mìdù shì ${c.p} kè měi lìfāng límǐ.`,answer:`The sample has a mass of ${mass} g and a volume of ${volume} cm³, so its density is ${density} g/cm³.`,facts:{mass,volume,density}};},
   rng=>{const x=integer(1,50,rng),y=integer(1,50,rng),a=numeral(x),b=numeral(y);return {text:`当 x 等于${a.h}时，y 等于${b.h}。`,pinyin:`dāng x děngyú ${a.p} shí, y děngyú ${b.p}.`,answer:`When x equals ${x}, y equals ${y}.`,facts:{x,y}};},
   rng=>{const amount=integer(1,50,rng),q=numeral(amount),tool=choose([['试管','shìguǎn','a test tube'],['烧杯','shāobēi','a beaker'],['烧瓶','shāopíng','a flask']],rng);return {text:`将${q.h}毫升溶液加入${tool[0]}，然后轻轻摇匀。`,pinyin:`jiāng ${q.p} háoshēng róngyè jiārù ${tool[1]}, ránhòu qīngqīng yáoyún.`,answer:`Add ${amount} ml of solution to ${tool[2]}, then gently shake to mix.`,facts:{millilitres:amount}};},
   rng=>{const pair=choose([
    ['收集数据','shōují shùjù','collect the data','进行分析','jìnxíng fēnxī','analyse it'],
    ['称量样品','chēngliáng yàngpǐn','weigh the sample','计算密度','jìsuàn mìdù','calculate its density'],
    ['加热溶液','jiārè róngyè','heat the solution','观察颜色','guānchá yánsè','observe its colour'],
    ['检查电路','jiǎnchá diànlù','check the circuit','测量电压','cèliáng diànyā','measure the voltage'],
    ['记录结果','jìlù jiéguǒ','record the results','得出结论','déchū jiélùn','draw a conclusion'],
    ['建立模型','jiànlì móxíng','build a model','检验假设','jiǎnyàn jiǎshè','test the hypothesis'],
    ['整理数据','zhěnglǐ shùjù','organise the data','绘制图表','huìzhì túbiǎo','draw a chart'],
    ['关闭电源','guānbì diànyuán','switch off the power','更换导线','gēnghuàn dǎoxiàn','replace the wire']
   ],rng),intro=choose([['请','qǐng','Please'],['我们需要','wǒmen xūyào','We need to'],['老师要求我们','lǎoshī yāoqiú wǒmen','The teacher asks us to']],rng);return {text:`${intro[0]}先${pair[0]}，再${pair[3]}。`,pinyin:`${intro[1]} xiān ${pair[1]}, zài ${pair[4]}.`,answer:`${intro[2]} first ${pair[2]}, then ${pair[5]}.`};}
  ]
 };
 function shuffle(values,rng){const list=[...values];for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
 function generate(topic,recent=[],rng=Math.random){
  topic=topic==='stem'?'stem':'everyday';const pool=families[topic],avoid=new Set(recent);let family,item;
  for(let attempt=0;attempt<1000;attempt++){family=choose(pool,rng);item=family(rng);if(!avoid.has(item.text))break;item=null;}
  if(!item)throw new Error('A fresh sentence could not be prepared. Please try again.');
  const options=new Set([item.answer]);for(let attempt=0;options.size<4&&attempt<1000;attempt++)options.add(family(rng).answer);
  if(options.size!==4)throw new Error('Answer choices could not be prepared. Please try again.');
  return {...item,id:item.text,topic,choices:shuffle([...options],rng)};
 }
 scope.HPListening=Object.freeze({generate,numeral});
})(typeof window==='undefined'?globalThis:window);
