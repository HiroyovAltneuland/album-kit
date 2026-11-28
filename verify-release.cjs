'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'album-kit-release-'));
try{
 const source=path.join(root,'source'),album=path.join(root,'日本語 album');
 fs.cpSync(__dirname,source,{recursive:true,filter:file=>!path.relative(__dirname,file).split(path.sep).includes('.git')});
 fs.mkdirSync(path.join(source,'.git'));fs.writeFileSync(path.join(source,'.git','test'),'repository metadata');fs.writeFileSync(path.join(source,'.env.private'),'dummy secret');
 execFileSync(process.execPath,[path.join(source,'create.cjs'),album],{encoding:'utf8'});
 assert(fs.existsSync(path.join(album,'script')));
 assert(fs.existsSync(path.join(album,'album-kit','build-scenarios.cjs')));
 assert(fs.existsSync(path.join(album,'index.html')));assert(fs.existsSync(path.join(album,'album-kit','crop-editor.js')));assert(fs.existsSync(path.join(album,'album-kit','LICENSE')));
 assert(!fs.existsSync(path.join(album,'album-kit','.git')));assert(!fs.existsSync(path.join(album,'album-kit','.env.private')));
 const project=require('./project.cjs'),data=project.load(album);
 fs.mkdirSync(path.join(album,'image'),{recursive:true});fs.writeFileSync(path.join(album,'image','share.png'),'fixture');
 data.ogp={url:'https://example.com/album/',title:'Shared "Album"',image:'image/share.png'};
 const result=project.build(album,data);
 const html=fs.readFileSync(path.join(album,result.folder,'index.html'),'utf8');
 assert(html.includes('property="og:image" content="https://example.com/album/image/share.png"'));
 assert(html.includes('content="Shared &quot;Album&quot;"'));
 assert(fs.existsSync(path.join(album,result.folder,'image/share.png')));
 const template={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(album,result.folder,'album-kit','template.js'),'utf8'),template);
 const markup=template.window.ALBUM_TEMPLATE;
 assert(markup.includes('href="https://github.com/HiroyovAltneuland/album-kit"'));
 assert(markup.indexOf('Powered by Album Kit')<markup.indexOf('id="reader"'));
 assert(fs.existsSync(path.join(album,result.folder,'LICENSE')));assert(!fs.existsSync(path.join(album,result.folder,'album-kit','studio.js')));
 console.log('PASS: independent project generation/build, MIT notice distribution, and exclusion of Git metadata and local secrets.');
}finally{
 assert(path.resolve(root).startsWith(path.join(os.tmpdir(),'album-kit-release-')));fs.rmSync(root,{recursive:true,force:true});
}
