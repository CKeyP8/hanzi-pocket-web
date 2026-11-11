import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';

const catalog=JSON.parse(readFileSync('public/csca-catalog.json','utf8'));
const stem=catalog.words.filter((w:any)=>w.track==='stem');
describe('Curated CSCA subject coverage',()=>{
 it('preserves every original card, ID, meaning, pronunciation and official row reference',()=>{
  const original=catalog.words.map(({subjects,...word}:any)=>word);
  expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('3de0962dba1e24a0685cef5089de59d1e51c0dee00dd3c2dc3e7bd8245dc7bc6');
  expect(stem).toHaveLength(948);expect(stem.flatMap((w:any)=>w.officialRefs)).toHaveLength(950);
  const foundation=catalog.words.filter((w:any)=>w.track==='foundation');expect(foundation).toHaveLength(5062);expect(foundation.flatMap((w:any)=>w.officialRefs)).toHaveLength(5164);
 });
 it('assigns every official STEM card to valid fields without duplicating cards or tagging foundation words',()=>{
  const subjects=catalog.subjects.map((s:any)=>s.id);expect(subjects).toEqual(['math','physics','chemistry','computing','shared']);
  expect(new Set(stem.map((w:any)=>w.id)).size).toBe(948);
  for(const w of stem){expect(w.subjects.length).toBeGreaterThan(0);expect(new Set(w.subjects).size).toBe(w.subjects.length);expect(w.subjects.every((s:string)=>subjects.includes(s))).toBe(true);}
  for(const w of catalog.words.filter((w:any)=>w.track==='foundation'))expect(w.subjects).toBeUndefined();
  expect(catalog.subjectGrouping.author).toBe('Hanzi Pocket');expect(catalog.subjectGrouping.method).toContain('not official CSCA subject labels');
 });
 it('places representative scientific terms and cross-field terms in their relevant subjects at every level',()=>{
  const tags=(hanzi:string)=>stem.find((w:any)=>w.h===hanzi).subjects;
  expect(tags('勾股定理')).toEqual(['math']);expect(tags('欧姆定律')).toEqual(['physics']);expect(tags('盐酸')).toEqual(['chemistry']);expect(tags('处理器')).toEqual(['computing']);expect(tags('根据')).toEqual(['shared']);
  expect(tags('向量')).toEqual(expect.arrayContaining(['math','physics']));expect(tags('元素')).toEqual(expect.arrayContaining(['math','physics','chemistry']));expect(tags('原子')).toEqual(expect.arrayContaining(['physics','chemistry']));
  for(const s of catalog.subjects)for(const stage of ['beginner','intermediate','advanced'])expect(stem.filter((w:any)=>w.subjects.includes(s.id)&&w.officialRefs.some((r:any)=>r.stage===stage)).length).toBeGreaterThan(0);
 });
});
