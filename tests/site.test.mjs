import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
const read=p=>readFileSync(p,'utf8');
const data=JSON.parse(read('src/data/project.json'));
const manifest=JSON.parse(read('public/models/manifest.json'));
const pages=['dist/index.html','dist/teknik-notlar/index.html','dist/404.html'];
test('R13 public data preserves measured-versus-calculated and delivery states',()=>{
 assert.deepEqual(JSON.parse(read('public/data/project-r13.json')),data);
 assert.equal(data.revision,'R13');assert.equal(data.targetYear,2027);
 assert.equal(data.spanMm,1798.3);assert.ok(Math.abs(data.nominalMassG-3557.88896429)<.001);
 assert.equal(data.manufacturingReleased,false);assert.equal(data.flightReleased,false);
 assert.equal(data.hardware.find(x=>x.name==='T3-GEM-O1').status,'Teslimat bekleniyor');
 assert.equal(data.hardware.find(x=>x.name==='6S batarya').status,'Seçim aşamasında');
});
test('GLB is complete and agrees with CAD derivative manifest',()=>{
 const b=readFileSync('public/models/est34-r13.glb');
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)).trim());
 assert.equal(gltf.meshes.length,manifest.display_meshes);assert.equal(manifest.display_meshes,134);assert.equal(manifest.cad_bodies,data.cadBodies);
 const names=new Set(gltf.nodes.map(x=>x.name));
 for(const n of ['wing_starboard','wing_port','pod_shell_candidate','elevator','battery_reference'])assert.ok(names.has(n),n);
 assert.equal(manifest.source_step_sha256.length,64);
});
test('generated pages have unique IDs, working anchors, local assets and metadata',()=>{
 for(const page of pages){
 const html=read(page);assert.match(html,/<html lang="tr"/);assert.match(html,/<title>/);assert.match(html,/name="viewport"/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,page);
 for(const m of html.matchAll(/(?:href|src)="([^"\s]+)"/g)){
  const url=m[1];if(url.startsWith('#'))assert.ok(ids.includes(url.slice(1)),`${page}: ${url}`);
  else if(url.startsWith('/')&&!url.startsWith('//'))assert.ok(existsSync(join('dist',url.endsWith('/')?url+'index.html':url)),`${page}: ${url}`);
 }
 }
 const html=read(pages[0]);assert.doesNotMatch(html,/Pixhawk|Raspberry Pi|2100\s*mm|candidate_003/);
 assert.match(html,/fiziksel tartım sonucu değildir/);assert.match(html,/Batarya satın alınmadı/);
 assert.ok(existsSync('dist/images/og-r13.jpg'));
});
test('initial page does not eagerly download CAD or Three.js',()=>{
 const html=read(pages[0]);const scripts=[...html.matchAll(/<script[^>]*src="([^"\s]+)"/g)].map(x=>x[1]);
 assert.equal(scripts.length,1);
 const initial=read(join('dist',scripts[0]));assert.ok(Buffer.byteLength(initial)<8000);assert.match(initial,/import\(/);
 assert.doesNotMatch(html,/<link[^>]*modulepreload[^>]*model/);
 assert.ok(readFileSync('public/images/est34-r13.webp').length<350000);
});
