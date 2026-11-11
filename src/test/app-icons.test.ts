import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';

const read=(file:string)=>readFileSync('public/'+file);
describe('Home Screen icon assets',()=>{
 it('provides compact opaque PNGs at the actual declared launcher dimensions',()=>{
  for(const size of [180,192,512]){
   const png=read(`icons/fire-horse-v2-${size}.png`);
   expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
   expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);
   expect(png[24]).toBe(8);expect(png[25]).toBe(2); // 8-bit RGB, no alpha.
   expect(png.length).toBeLessThan(size===512?500000:100000);
   const chunks:string[]=[];for(let at=8;at<png.length;at+=12+png.readUInt32BE(at))chunks.push(png.subarray(at+4,at+8).toString('ascii'));
   expect(chunks).not.toContain('caBX');expect(chunks.at(-1)).toBe('IEND');
  }
 });
 it('links the explicitly sized iPhone PNG through a fresh filename',()=>{
  const html=readFileSync('index.html','utf8');
  const apple=html.match(/<link\s[^>]*rel="apple-touch-icon"[^>]*>/)?.[0];
  expect(apple).toContain('sizes="180x180"');expect(apple).toContain('type="image/png"');expect(apple).toContain('%BASE_URL%icons/fire-horse-v2-180.png');
 });
 it('keeps the chosen artwork on legacy paths used by older app metadata',()=>{
  for(const [alias,size]of [['apple-touch-icon.png',180],['app-icon.png',512],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]as const)expect(read(alias)).toEqual(read(`icons/fire-horse-v2-${size}.png`));
 });
});
