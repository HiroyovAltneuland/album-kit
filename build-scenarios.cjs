'use strict';
const fs=require('node:fs'),path=require('node:path');
const {local}=require('./project.cjs');
function readSources(root){
 const folder=local(root,'script');
 if(!fs.existsSync(folder))throw new Error('script/ フォルダを作成し、UTF-8の .ks 原稿を置いてください');
 const names=fs.readdirSync(folder).filter(name=>/\.ks$/i.test(name)).sort();
 if(!names.length)throw new Error('script/ に .ks 原稿がありません');
 return Object.fromEntries(names.map(name=>[name,fs.readFileSync(local(root,'script/'+name),'utf8').replace(/^\uFEFF/,'')]));
}
function availability(root){
 if(fs.existsSync(path.join(root,'album.project.json')))return {available:false,reason:'保存済みの制作データがあるため、取り込みません'};
 if(fs.existsSync(path.join(root,'scenarios.js')))return {available:false,reason:'scenarios.js は作成済みです'};
 const folder=local(root,'script');
 const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>/\.ks$/i.test(name)).sort():[];
 return {available:files.length>0,files,reason:files.length?'':'script/ に .ks 原稿がありません'};
}
function writeSources(root,sources,{exclusive=false}={}){
 fs.writeFileSync(local(root,'scenarios.js'),'window.SCENARIO_SOURCES = '+JSON.stringify(sources,null,2)+';\n',{flag:exclusive?'wx':'w'});
 return Object.keys(sources).length;
}
function compile(root){root=path.resolve(root);return writeSources(root,readSources(root));}
module.exports={compile,availability,readSources,writeSources};
if(require.main===module){try{const root=process.argv[2] || path.join(__dirname,'..');console.log('Generated scenarios.js from '+compile(root)+' scripts.');}catch(error){console.error(error.message);process.exitCode=1;}}
