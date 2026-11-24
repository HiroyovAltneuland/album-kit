'use strict';
window.ALBUM_STUDIO=true;
(function(){
 const base=new URL('../',document.baseURI),sample=new URL('sample/',base),library=new URL('assets/album-kit/',base);
 const uploads=new Map(),urls=new Map();let current,totalBytes=0;
 const initial=fetch(new URL('sample.json',base)).then(r=>{if(!r.ok)throw new Error('サンプルを読み込めません');return r.json();});
 const safe=file=>typeof file==='string' && file && !/[\\\x00-\x1f?#:]/.test(file) && !file.startsWith('/') && !file.split('/').some(p=>p==='.'||p==='..');
 function assetURL(file){if(!safe(file))throw new Error('素材にはプロジェクト内の相対パスを指定してください');return urls.get(file)||new URL(file,sample).href;}
 function check(data){window.AlbumKit.validate(data);for(const chapter of data.chapters){if(!chapter.pages)throw new Error('pages形式で指定してください');}for(const file of assets(data))if(!safe(file))throw new Error('不正な素材パスです');}
 function assets(data){const found=new Set();const add=p=>{if(p)found.add(p);};add(data.cover);for(const t of data.tracks)add((data.audioBase||'')+t.file);for(const c of data.chapters){add(c.image);for(const p of c.pages){if(p.image)add((data.imageBase||'')+p.image);if(p.bgm)add((data.audioBase||'')+p.bgm);}}return [...found];}
 async function bytes(url){const r=await fetch(url);if(!r.ok)throw new Error('ファイルを読み込めません: '+new URL(url).pathname);return new Uint8Array(await r.arrayBuffer());}
 function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 async function pack(data,editable){
  check(data);const entries=new Map(),manifest=await(await fetch(new URL('project-manifest.json',base))).json();
  const files=editable?manifest.files:['index.html','album-kit/base.css','album-kit/theme.css','album-kit/template.js','album-kit/setup.js','album-kit/player.js','album-kit/LICENSE'];
  for(const file of files)entries.set(file,await bytes(new URL(file,new URL('project/',base))));
  entries.set('album.config.js','window.ALBUM_CONFIG = '+JSON.stringify(data,null,2)+';\n');
  if(editable)entries.set('album.project.json',JSON.stringify(data,null,2)+'\n');
  entries.set('LICENSE',await bytes(new URL('LICENSE',base)));
  for(const file of assets(data))entries.set(file,uploads.get(file)||await bytes(assetURL(file)));
  download(editable?'album-kit-project.zip':'album-kit-published.zip',window.AlbumZip.zip([...entries]),'application/zip');
  return {folder:editable?'制作一式ZIPをダウンロードしました':'公開用ZIPをダウンロードしました',files:entries.size};
 }
 window.ALBUM_STUDIO_ADAPTER={assetURL,
  async request(url,data){
   const route=new URL(url,base);
   if(route.pathname==='/api/project'){current=await initial;return {config:structuredClone(current),root:'ブラウザ体験版：編集内容はこのタブ内のみ。保存で制作一式ZIPをダウンロードできます。',scenarioCompile:{available:false}};}
   if(route.pathname==='/api/asset'){
    if(data.size>64*1024*1024 || totalBytes+data.size>256*1024*1024)throw new Error('体験版の素材は1ファイル64MB、合計256MBまでです');
    const ext=data.name.split('.').pop().toLowerCase();if(!/^(png|jpg|jpeg|webp|gif|avif|mp3|wav|ogg|m4a|aac|flac)$/.test(ext))throw new Error('画像または音源を選んでください');
    const content=new Uint8Array(await data.arrayBuffer()),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',content))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const folder=/^(png|jpg|jpeg|webp|gif|avif)$/.test(ext)?'image/':'mp3/',path=folder+hash.slice(0,16)+'.'+ext,reused=uploads.has(path);
    if(!reused){uploads.set(path,content);urls.set(path,URL.createObjectURL(data));totalBytes+=content.length;}
    return {path,file:path.slice(folder.length),reused};
   }
   check(data);current=structuredClone(data);
   if(route.pathname==='/api/preview')return {ready:true};
   if(route.pathname==='/api/save')return pack(data,true);
   if(route.pathname==='/api/build')return pack(data,false);
   throw new Error('体験版ではこの操作を利用できません');
  },
  async preview(data,chapter,page){
   const shown=structuredClone(data);
   if(shown.cover)shown.cover=assetURL(shown.cover);
   for(const t of shown.tracks)t.file=assetURL((data.audioBase||'')+t.file);
   for(const c of shown.chapters){if(c.image)c.image=assetURL(c.image);for(const p of c.pages){if(p.image)p.image=assetURL((data.imageBase||'')+p.image);if(p.bgm)p.bgm=assetURL((data.audioBase||'')+p.bgm);}}
   shown.audioBase='';shown.imageBase='';
   const js=JSON.stringify(shown).replace(/</g,'\\u003c');
   const scripts=['template.js','setup.js','player.js'].map(file=>'<script src="'+new URL(file,library).href+'"><\/script>').join('');
   const frame=document.getElementById('preview');
   const target=chapter===undefined?null:{chapter,page:page||0};
   const html='<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+new URL('base.css',library).href+'"><link rel="stylesheet" href="'+new URL('theme.css',library).href+'"><script>window.ALBUM_PREVIEW=true;window.ALBUM_PREVIEW_LOCATION='+JSON.stringify(target)+';window.ALBUM_CONFIG='+js+';<\/script></head><body><div id="album-root"></div>'+scripts+'</body></html>';
   frame.srcdoc=html;
  }
 };
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('save').textContent='制作一式を保存';document.getElementById('build').textContent='公開用ZIP';
  document.querySelector('.wordmark span').textContent='ブラウザ体験版';
  document.querySelector('#build-result p:not(.kicker)').textContent='ZIPを解凍し、中身をGitHub Pagesなどの静的ホスティングへアップロードしてください。';
 });
})();
