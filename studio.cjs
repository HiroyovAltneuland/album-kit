'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const project = require('./project.cjs');
const scenarios = require('./build-scenarios.cjs');
const mime = {'.svg':'image/svg+xml','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.flac':'audio/flac','.aac':'audio/aac'};
async function body(req,limit) {
  const chunks=[];let size=0;
  for await (const chunk of req) {size+=chunk.length;if(size>limit)throw new Error('ファイルが大きすぎます');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
function start(root, options={}) {
  root=fs.realpathSync(root);
  let draft, startupError;
  try { draft=project.load(root); }
  catch(error) {
    if (!scenarios.availability(root).available) throw error;
    draft=null;startupError=error.message;
  }
  let baseline=JSON.stringify(draft), draftChanged=false;
  const sourceConfigFile=path.join(root,'album.config.js');
  const originalConfig=fs.existsSync(sourceConfigFile)?fs.readFileSync(sourceConfigFile,'utf8'):null;
  const token=crypto.randomBytes(24).toString('hex');
  let origin;
  const server=http.createServer(async(req,res)=>{
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      if (req.headers.host !== new URL(origin).host) return json({error:'Invalid host'},403);
      const url=new URL(req.url,origin);
      if (url.pathname.startsWith('/api/')) {
        if(req.headers['x-album-token']!==token || (req.headers.origin && req.headers.origin!==origin))return json({error:'この制作画面から操作してください'},403);
        if(req.method==='GET' && url.pathname==='/api/project')return json({config:draft,root,scenarioCompile:scenarios.availability(root),startupError});
        if(req.method==='POST' && url.pathname==='/api/compile-scenarios') {
          await body(req,1024);
          const state=scenarios.availability(root);
          if(!state.available)return json({error:state.reason},409);
          if(draftChanged)return json({error:'編集中のデータを保護するため変換できません。現在の内容を保存してください'},409);
          const currentConfig=fs.existsSync(sourceConfigFile)?fs.readFileSync(sourceConfigFile,'utf8'):null;
          if(currentConfig!==originalConfig)return json({error:'作品設定が変更されています。制作室を起動し直してください'},409);
          const sources=scenarios.readSources(root);
          // Parse and validate before creating the only output; never change JSON or config.
          const imported=project.load(root,{scenarioSources:sources});
          project.check(imported);
          const changed=JSON.stringify(imported)!==baseline;
          const count=scenarios.writeSources(root,sources,{exclusive:true});
          draft=imported;baseline=JSON.stringify(draft);startupError=undefined;
          return json({config:draft,count,imported:changed,scenarioCompile:scenarios.availability(root)});
        }
        if(req.method==='POST' && url.pathname==='/api/asset') {
          const name=url.searchParams.get('name') || '';
          if(!name || name!==path.basename(name) || /[\\/:\x00-\x1f]/.test(name))throw new Error('ファイル名が不正です');
          const ext=path.extname(name).toLowerCase();
          if(!/^\.(png|jpe?g|webp|gif|avif|mp3|wav|ogg|m4a|aac|flac)$/.test(ext))throw new Error('画像か音声ファイルを選んでください');
          const folder=/^\.(png|jpe?g|webp|gif|avif)$/.test(ext)?'image/':'mp3/';
          const file=folder+crypto.randomBytes(4).toString('hex')+'-'+name;
          const absolute=project.local(root,file);
          const buffer=await body(req,256*1024*1024);
          fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,buffer,{flag:'wx'});
          return json({path:file,file:path.basename(file)});
        }
        if(req.method==='POST' && ['/api/preview','/api/save','/api/build'].includes(url.pathname)) {
          if(!draft)return json({error:'先にシナリオをコンパイルしてください'},409);
          const config=JSON.parse((await body(req,8*1024*1024)).toString());project.check(config);
          // Validate paths before allowing them into the preview.
          for(const file of project.assets(config))project.local(root,file);
          draftChanged ||= JSON.stringify(config)!==baseline;
          draft=config;
          if(url.pathname==='/api/save'){project.save(root,config);return json({saved:true});}
          if(url.pathname==='/api/build'){const result=project.build(root,config);project.save(root,config);return json(result);}
          return json({ready:true});
        }
        return json({error:'Not found'},404);
      }
      if(req.method!=='GET' && req.method!=='HEAD')return json({error:'Method not allowed'},405);
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      if(url.pathname==='/') {
        const html=fs.readFileSync(path.join(__dirname,'studio.html'),'utf8').replace('__ALBUM_TOKEN__',token);
        res.writeHead(200,{'Content-Type':mime['.html']});return res.end(html);
      }
      if(url.pathname.startsWith('/preview/') && !draft)return json({error:'シナリオのコンパイル待ちです'},409);
      if(url.pathname==='/preview/album.config.js') {
        res.writeHead(200,{'Content-Type':mime['.js']});return res.end('window.ALBUM_PREVIEW = true; window.ALBUM_CONFIG = '+JSON.stringify({...draft,id:draft.id+'-preview'})+';');
      }
      if(url.pathname==='/preview/index.html') {
        res.writeHead(200,{'Content-Type':mime['.html']});return res.end(fs.readFileSync(path.join(__dirname,'starter.html')));
      }
      let file;
      if(['/branding/favicon.svg','/branding/favicon.ico','/branding/apple-touch-icon.png'].includes(url.pathname)) {
        file=path.join(__dirname,url.pathname.slice(1));
      } else if(url.pathname.startsWith('/preview/album-kit/')) {
        const name=url.pathname.slice('/preview/album-kit/'.length);
        if(!project.runtime.includes(name))return json({error:'Not found'},404);
        file=path.join(__dirname,name);
      } else if(['/studio.js','/studio.css','/crop-editor.js'].includes(url.pathname))file=path.join(__dirname,url.pathname.slice(1));
      else if(url.pathname.startsWith('/preview/')) {
        const value=decodeURIComponent(url.pathname.slice('/preview/'.length));
        if(!project.assets(draft).includes(value))return json({error:'Not found'},404);
        file=project.local(root,value);
      } else return json({error:'Not found'},404);
      const stat=fs.statSync(file);if(!stat.isFile())throw new Error('素材ファイルではありません');const type=mime[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // Audio seeking needs byte ranges in the live preview.
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      if(match) {
        const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
        if(start>end || start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}
        res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});
        if(req.method==='HEAD')return res.end();return fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
      }
      res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Accept-Ranges':'bytes'});
      if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    }catch(error){if(!res.headersSent)json({error:error.message},400);else res.destroy();}
  });
  server.listen(options.port || 0,'127.0.0.1',()=>{
    origin='http://127.0.0.1:'+server.address().port;
    console.log('Album Kit Studio: '+origin+'\nProject: '+root+'\nClose this window or press Ctrl+C to stop.');
    if(options.open) {
      const child=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',origin],{stdio:'ignore',windowsHide:true}):spawn(process.platform==='darwin'?'open':'xdg-open',[origin],{stdio:'ignore'});
      child.on('error',()=>console.log('Open '+origin+' in your browser.'));child.unref();
    }
  });
  return server;
}
module.exports={start};
if(require.main===module)start(path.resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--')) || path.join(__dirname,'..')),{open:!process.argv.includes('--no-open')});
