'use strict';
const fs=require('node:fs'),path=require('node:path');
const {local}=require('./project.cjs');
function compile(root){
 root=path.resolve(root);
 const folder=local(root,'script');
 if(!fs.existsSync(folder))throw new Error('script/ フォルダを作成し、UTF-8の .ks 原稿を置いてください');
 const names=fs.readdirSync(folder).filter(name=>/\.ks$/i.test(name)).sort();
 if(!names.length)throw new Error('script/ に .ks 原稿がありません');
 const sources=Object.fromEntries(names.map(name=>[name,fs.readFileSync(local(root,'script/'+name),'utf8').replace(/^\uFEFF/,'')]));
 fs.writeFileSync(local(root,'scenarios.js'),'window.SCENARIO_SOURCES = '+JSON.stringify(sources,null,2)+';\n');
 return names.length;
}
module.exports={compile};
if(require.main===module){try{const root=process.argv[2] || path.join(__dirname,'..');console.log('Generated scenarios.js from '+compile(root)+' scripts.');}catch(error){console.error(error.message);process.exitCode=1;}}
