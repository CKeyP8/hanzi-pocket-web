import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,sep} from 'node:path';
const manifest=JSON.parse(readFileSync(new URL('./build-assets.json',import.meta.url),'utf8'));
const root=resolve('public');
for(const file of manifest.files){
  const target=resolve(root,file.path),inside=relative(root,target);
  if(inside==='..'||inside.startsWith('..'+sep))throw new Error('Invalid bundled asset path');
  const bytes=readFileSync(target);
  if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error(`Bundled data does not match its pinned checksum: ${file.path}`);
}
console.log(`Verified ${manifest.files.length} bundled data files. No external asset host required.`);
