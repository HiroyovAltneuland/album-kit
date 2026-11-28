'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const {buildDemo}=require('./build-demo.cjs'),{zip,crc32}=require('./demo/zip.js'),project=require('./project.cjs');
function unzip(input){const bytes=Buffer.from(input),files=new Map();let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+length).toString('utf8'),start=offset+30+length+extra,data=bytes.subarray(start,start+size);assert.equal(crc32(data),bytes.readUInt32LE(offset+14));files.set(name,data);offset=start+size;}assert.equal(bytes.readUInt32LE(offset),0x02014b50);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);assert.equal(bytes.readUInt16LE(bytes.length-12),files.size);return files;}
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'album-demo-'));
 try{
  buildDemo(root);
  assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('href="studio/"'));
  const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');assert(!/\b(?:src|href)="\//.test(html));assert(html.indexOf('adapter.js')<html.indexOf('/setup.js'));
  const files=unzip(fs.readFileSync(path.join(root,'album-kit-sample.zip')));
  assert(files.has('album-kit/studio.cjs'));assert(files.has('script/example.ks'));assert(![...files.keys()].some(f=>f.includes('.git')||f.startsWith('_site/')));
  const extracted=path.join(root,'unpacked');fs.mkdirSync(extracted);
  for(const [name,data]of files){const dest=path.join(extracted,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
  const config=project.load(extracted);project.check(config);const result=project.build(extracted,config);assert(fs.existsSync(path.join(extracted,result.folder,'mp3/morning.wav')));
  const publicZip=fs.readFileSync(path.join(root,'album-kit-sample.zip'));
  const requests=[],downloads=[],frame={setAttribute(name,value){this[name]=value;}},nativeFetch=fetch;
  const nodes={preview:frame,save:{},build:{}};
  const browser={AlbumKit:require('./setup.js'),AlbumZip:{zip}};
  const context={window:browser,TextEncoder,TextDecoder,Uint8Array,Blob,URL,btoa,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout(){},
   document:{baseURI:'https://demo.test/album-kit/studio/',addEventListener(){},getElementById:id=>nodes[id],createElement:()=>({click(){downloads.push(this.href);}})},
   fetch:async url=>{const target=new URL(url);if(target.protocol==='blob:')return nativeFetch(target);requests.push({method:'GET',path:target.pathname});assert(target.pathname.startsWith('/album-kit/'));const full=path.join(root,decodeURIComponent(target.pathname.slice('/album-kit/'.length)));return new Response(fs.existsSync(full)?fs.readFileSync(full):'missing',{status:fs.existsSync(full)?200:404});}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'demo/adapter.js'),'utf8'),context);
  const adapter=browser.ALBUM_STUDIO_ADAPTER,data=(await adapter.request('/api/project')).config;
  data.title='Example </script> title';await adapter.preview(data,1,2);assert(frame.srcdoc.includes('\\u003c/script>'));assert(frame.srcdoc.includes('ALBUM_PREVIEW_LOCATION={"chapter":1,"page":2}'));assert(!frame.srcdoc.includes('history.replaceState'));
  assert.equal(frame.sandbox,'allow-scripts');assert(frame.srcdoc.includes('Content-Security-Policy'));assert(frame.srcdoc.includes("connect-src 'none'"));assert(!frame.srcdoc.includes('allow-same-origin'));
  const upload=new Blob([Buffer.from('image-fixture')],{type:'image/png'});upload.name='sample.png';
  const first=await adapter.request('/api/asset',upload),again=await adapter.request('/api/asset',upload);assert.equal(first.path,again.path);assert.equal(again.reused,true);
  const disguised=new Blob(['<script>globalThis.injected=true</script>'],{type:'text/html'});disguised.name='disguised.png';
  const normalized=await adapter.request('/api/asset',disguised);assert.equal((await nativeFetch(adapter.assetURL(normalized.path))).headers.get('content-type'),'image/png');
  data.chapters[0].pages[0].image=first.file;
  await adapter.preview(data,0,0);assert(frame.srcdoc.includes('album-kit-upload:'+first.path));assert(frame.srcdoc.includes('Uint8Array.from(atob(value.data)'));
  const previewContext={window:{},Blob,Uint8Array,URL,atob};
  vm.runInNewContext(/<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(frame.srcdoc)[1],previewContext);
  const previewURL=previewContext.window.ALBUM_CONFIG.chapters[0].pages[0].image;
  assert(previewURL.startsWith('blob:'));assert.equal(await(await nativeFetch(previewURL)).text(),'image-fixture');URL.revokeObjectURL(previewURL);
  data.ogp={url:'https://example.com/album/',title:'Shared album',image:first.path};
  await adapter.request('/api/preview',data);await adapter.request('/api/save',data);await adapter.request('/api/build',data);assert.equal(downloads.length,2);
  const saved=unzip(await(await nativeFetch(downloads[0])).arrayBuffer()),published=unzip(await(await nativeFetch(downloads[1])).arrayBuffer());
  assert(saved.has('album.project.json'));assert(saved.has('album-kit/studio.cjs'));assert(published.has(first.path));assert(!published.has('album.project.json'));assert(!published.has('album-kit/studio.cjs'));assert(published.has('index.html'));
  assert.equal(JSON.parse(saved.get('album.project.json').toString()).title,data.title);
  for(const files of [saved,published])assert(files.get('index.html').toString().includes('property="og:image" content="https://example.com/album/'+first.path+'"'));
  const serialized={window:{}};vm.runInNewContext(published.get('album.config.js').toString(),serialized);assert.equal(serialized.window.ALBUM_CONFIG.title,data.title);assert.equal(serialized.injected,undefined);
  const invalid={...data,cover:'../private.png'};await assert.rejects(()=>adapter.request('/api/build',invalid),/不正/);
  for(const file of ['album.config.js','index.html','album-kit/player.js','album-kit/hidden.png','%2e%2e/private.png','%252e%252e/private.png','https://example.com/a.png','//example.com/a.png','image/../../a.png']){
   assert.throws(()=>adapter.assetURL(file));await assert.rejects(()=>adapter.request('/api/build',{...data,cover:file}),/不正/);
  }
  for(const name of ['../escape','/absolute','C:/escape.png','folder\\escape','image/NUL.png','image/file.','image/file '])assert.throws(()=>zip([[name,'data']]));
  assert.deepEqual(fs.readFileSync(path.join(root,'album-kit-sample.zip')),publicZip,'Client save must not alter the shared sample ZIP');
  assert(requests.every(r=>r.method==='GET'),'Static demo must never upload data to a server');
  for(const url of downloads)URL.revokeObjectURL(url);
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  console.log('PASS: static subpath hosting, original sample, ZIP CRC/structure, editable project reopening/build, local uploads/deduplication, safe preview, client-only save/build and path validation.');
 }finally{assert(path.resolve(root).startsWith(path.join(os.tmpdir(),'album-demo-')));fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
