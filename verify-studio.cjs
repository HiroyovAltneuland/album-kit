'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {once}=require('node:events');
const project=require('./project.cjs');
const {start}=require('./studio.cjs');
const studioSource=fs.readFileSync(path.join(__dirname,'studio.js'),'utf8');
const summary=require('node:vm').runInNewContext('('+studioSource.slice(studioSource.indexOf('function visualSummary('),studioSource.indexOf('const clone='))+')');
assert.equal(summary({}),'背景：章の画像');
assert.equal(summary({backgroundColor:'#000000',transition:'fade'}),'黒背景 ／ フェード 800ms');
assert.equal(summary({backgroundColor:'#FFFFFF',image:'ignored.png',portraitPosition:'20% 50%',transition:'black',transitionDuration:0}),'白背景 ／ 黒を挟む 0ms');
assert.equal(summary({image:'art/挿絵.png',portraitPosition:'20% 50%',transition:'crossfade',transitionDuration:1200}),'画像：挿絵.png ／ クロスフェード 1200ms ／ 画像位置：指定あり');
const audioContext={config:{tracks:[{file:'one.mp3',title:'One'},{file:'two.mp3',title:'Two'}]},audioPath:result=>result.file};
const registerAudio=require('node:vm').runInNewContext('('+studioSource.slice(studioSource.indexOf('function registerAudio('),studioSource.indexOf('function pageImagePath('))+')',audioContext);
assert.throws(()=>registerAudio({file:'one.mp3'}),/登録済み/);
assert.throws(()=>registerAudio({file:'two.mp3'},audioContext.config.tracks[0]),/登録済み/);
assert.equal(audioContext.config.tracks[0].file,'one.mp3');
registerAudio({file:'one.mp3'},audioContext.config.tracks[0]);assert.equal(audioContext.config.tracks.length,2);
registerAudio({file:'new.mp3'});assert.equal(audioContext.config.tracks.length,3);
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'album-studio-'));
 let server;
 try{
  fs.writeFileSync(path.join(root,'album.config.js'),`window.ALBUM_CONFIG={id:'studio-test',title:'テストアルバム',audioBase:'mp3/',imageBase:'image/',theme:'paper',font:'gothic',tracks:[],chapters:[{title:'Notes',pages:[{speaker:'',text:'本文',bgm:null}]}]};`);
  server=start(root);await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  const html=await(await fetch(origin)).text();const token=/name="album-token" content="([^"]+)"/.exec(html)[1];
  const protectedPage=await fetch(origin);assert.equal(protectedPage.headers.get('cross-origin-resource-policy'),'same-origin');assert.equal(protectedPage.headers.get('content-security-policy'),"frame-ancestors 'self'");
  assert.equal((await fetch(origin+'/preview/album.config.js',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert(html.includes('href="/branding/favicon.svg"'));
  const favicon=await fetch(origin+'/branding/favicon.svg');assert.equal(favicon.status,200);assert.equal(favicon.headers.get('content-type'),'image/svg+xml');
  const icon=await fetch(origin+'/branding/favicon.ico');assert.equal(icon.status,200);const bytes=Buffer.from(await icon.arrayBuffer());assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),3);
  assert.equal((await fetch(origin+'/branding/apple-touch-icon.png')).status,200);
  assert.equal((await fetch(origin+'/branding/private.png')).status,404);
  const headers={'X-Album-Token':token,'Content-Type':'application/json','Origin':origin};
  const api=async(route,data)=>{const result=await fetch(origin+'/api/'+route,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)});const value=await result.json();return {status:result.status,value};};
  assert.equal((await fetch(origin+'/api/project')).status,403);
  assert.equal((await fetch(origin+'/api/save',{method:'POST',headers:{...headers,Origin:'https://example.com'},body:'{}'})).status,403);
  let config=(await api('project')).value.config;
  const sourceOriginal=fs.readFileSync(path.join(root,'album.config.js'),'utf8');
  const imported=await fetch(origin+'/api/asset?name='+encodeURIComponent('日本語 audio.mp3'),{method:'POST',headers:{'X-Album-Token':token,Origin:origin},body:Buffer.from('audio-fixture')});
  const asset=await imported.json();assert.equal(imported.status,200);
  const repeatAudio=await fetch(origin+'/api/asset?name=renamed.mp3',{method:'POST',headers:{'X-Album-Token':token,Origin:origin},body:Buffer.from('audio-fixture')});
  const reusedAudio=await repeatAudio.json();assert.equal(repeatAudio.status,200);assert.equal(reusedAudio.path,asset.path);assert.equal(reusedAudio.reused,true);
  assert.equal(fs.readdirSync(path.join(root,'mp3')).length,1,'Identical audio must reuse the original file');
  const differentAudio=await fetch(origin+'/api/asset?name='+encodeURIComponent('日本語 audio.mp3'),{method:'POST',headers:{'X-Album-Token':token,Origin:origin},body:Buffer.from('other-fixture')});
  assert.equal(differentAudio.status,200);assert.notEqual((await differentAudio.json()).path,asset.path);
  assert.equal(fs.readFileSync(path.join(root,asset.path),'utf8'),'audio-fixture','Changed audio must not overwrite an earlier version');
  const imageDir=path.join(root,'image');fs.mkdirSync(imageDir);
  fs.writeFileSync(path.join(imageDir,'existing.png'),'image-fixture');
  const uploadImage=async(name,content)=>{
    const response=await fetch(origin+'/api/asset?name='+encodeURIComponent(name),{method:'POST',headers:{'X-Album-Token':token,Origin:origin},body:Buffer.from(content)});
    assert.equal(response.status,200);return response.json();
  };
  const reused=await uploadImage('renamed.png','image-fixture');
  assert.equal(reused.path,'image/existing.png');assert.equal(reused.reused,true);
  const different=await uploadImage('existing.png','other-fixture');
  assert.notEqual(different.path,reused.path);
  assert.equal((await uploadImage('again.png','other-fixture')).path,different.path);
  assert.equal(fs.readdirSync(imageDir).length,2,'Identical image uploads must not create more files');
  assert.equal(fs.readFileSync(path.join(imageDir,'existing.png'),'utf8'),'image-fixture');
  config.tracks=[{file:asset.file,title:'試聴曲'}];
  config.title='編集したアルバム';
  assert.equal((await api('preview',config)).status,200);
  assert(!fs.existsSync(path.join(root,'album.project.json')),'Preview must not save');
  assert((await(await fetch(origin+'/preview/album.config.js')).text()).includes('ALBUM_PREVIEW = true'));
  const range=await fetch(origin+'/preview/'+encodeURI(asset.path),{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'dio-');
  assert.equal((await fetch(origin+'/preview/album.project.json')).status,404);
  assert.equal((await fetch(origin+'/preview/album-kit/studio.cjs')).status,404);
  const bad={...config,cover:'../private.png'};assert.equal((await api('preview',bad)).status,400);
  assert.equal((await api('save',config)).status,200);
  assert.equal(project.load(root).title,'編集したアルバム');
  assert.equal(fs.readFileSync(path.join(root,'album.config.js'),'utf8'),sourceOriginal);
  config.cover='image/missing.png';assert.equal((await api('build',config)).status,400);assert(!fs.existsSync(path.join(root,'dist')));
  delete config.cover;
  const result=await api('build',config);assert.equal(result.status,200);
  const output=path.join(root,result.value.folder);assert(fs.existsSync(path.join(output,'index.html')));assert(fs.readFileSync(path.join(output,'LICENSE'),'utf8').startsWith('MIT License'));assert(fs.existsSync(path.join(output,asset.path)));
  assert(!fs.existsSync(path.join(output,'album-kit/studio.cjs')));assert(!fs.existsSync(path.join(output,'album.project.json')));
  for(const name of project.runtime)assert(fs.existsSync(path.join(output,'album-kit',name)));
  const second=await api('build',config);assert.notEqual(second.value.folder,result.value.folder);
  assert.equal((await fetch(origin+'/api/asset?name=bad.svg',{method:'POST',headers,body:'<svg/>'})).status,400);
  assert.throws(()=>project.local(root,'image/../../outside.png'));
  assert.throws(()=>project.local(root,'https://example.com/image.png'));
  console.log('PASS: load/import, authenticated editor API, preview without save, byte-range audio, save/reopen, missing assets, isolated static build, unique outputs, path restrictions.');
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  const resolved=path.resolve(root);assert(resolved.startsWith(path.join(os.tmpdir(),'album-studio-')));fs.rmSync(resolved,{recursive:true,force:true});
 }
 const legacy=fs.mkdtempSync(path.join(os.tmpdir(),'album-studio-legacy-'));
 try {
  fs.writeFileSync(path.join(legacy,'album.config.js'),"window.ALBUM_CONFIG={id:'legacy',title:'Sample',tracks:[],speakers:['Artist'],chapters:[{title:'Notes',file:'01.ks'}]};");
  fs.mkdirSync(path.join(legacy,'script'));
  fs.writeFileSync(path.join(legacy,'script','01.ks'),'\uFEFF#Artist\nSample liner notes.[p]\nAnother page.');
  assert.equal(require('./build-scenarios.cjs').compile(legacy),1);
  const loaded=project.load(legacy);assert.equal(loaded.chapters.length,1);assert.equal(loaded.chapters[0].pages.length,2);assert.equal(loaded.chapters[0].pages[0].speaker,'Artist');
  console.log('PASS: legacy scenario import using an independent fixture.');
 } finally { assert(path.resolve(legacy).startsWith(path.join(os.tmpdir(),'album-studio-legacy-')));fs.rmSync(legacy,{recursive:true,force:true}); }

}
main().catch(error=>{console.error(error);process.exitCode=1;});
