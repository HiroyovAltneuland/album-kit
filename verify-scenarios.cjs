'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {once}=require('node:events');
const {start}=require('./studio.cjs');
const config=()=>({id:'compile-test',title:'Sample',tracks:[],chapters:[{title:'Notes',pages:[{text:'Keep this input',portraitPosition:'25% 50%'}]}]});
async function fixture(setup,test){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'album-compile-'));let server;
 try{
  const cfg=config();await setup(root,cfg);if(!fs.existsSync(path.join(root,'album.config.js')))fs.writeFileSync(path.join(root,'album.config.js'),'window.ALBUM_CONFIG='+JSON.stringify(cfg)+';');
  server=start(root);await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  const html=await(await fetch(origin)).text(),token=/name="album-token" content="([^"]+)"/.exec(html)[1];
  const api=async(route,data)=>{const result=await fetch(origin+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{'X-Album-Token':token,'Content-Type':'application/json',Origin:origin},body:data===undefined?undefined:JSON.stringify(data)});return {status:result.status,value:await result.json()};};
  await test(root,api,cfg);
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert(path.resolve(root).startsWith(path.join(os.tmpdir(),'album-compile-')));fs.rmSync(root,{recursive:true,force:true});}
}
function script(root,text='#Artist\nImported text.[p]\nSecond page.') {fs.mkdirSync(path.join(root,'script'));fs.writeFileSync(path.join(root,'script','01.ks'),text);}
async function main(){
 await fixture((root,cfg)=>{script(root);cfg.chapters=[{title:'Notes',file:'01.ks'}];},async(root,api)=>{
  const initial=(await api('project')).value;assert.equal(initial.config,null);assert(initial.scenarioCompile.available);
  assert.equal((await api('save',config())).status,409);
  const original=fs.readFileSync(path.join(root,'album.config.js'),'utf8');
  const result=await api('compile-scenarios',{});assert.equal(result.status,200);assert.equal(result.value.config.chapters[0].pages.length,2);assert(result.value.imported);
  assert.equal(fs.readFileSync(path.join(root,'album.config.js'),'utf8'),original);assert(!fs.existsSync(path.join(root,'album.project.json')));
  const compiled=fs.readFileSync(path.join(root,'scenarios.js'),'utf8');assert.equal((await api('compile-scenarios',{})).status,409);assert.equal(fs.readFileSync(path.join(root,'scenarios.js'),'utf8'),compiled);assert(!(await api('project')).value.scenarioCompile.available);
 });
 await fixture(root=>script(root),async(root,api,cfg)=>{const result=await api('compile-scenarios',{});assert.equal(result.status,200);assert.deepEqual(result.value.config,cfg);assert.equal(result.value.imported,false);});
 await fixture(root=>script(root),async(root,api,cfg)=>{cfg.title='Unsaved edit';assert.equal((await api('preview',cfg)).status,200);assert.equal((await api('compile-scenarios',{})).status,409);assert(!fs.existsSync(path.join(root,'scenarios.js')));assert.equal((await api('project')).value.config.title,'Unsaved edit');});
 await fixture((root,cfg)=>{script(root);fs.writeFileSync(path.join(root,'album.project.json'),JSON.stringify(cfg));},async(root,api)=>{assert(!(await api('project')).value.scenarioCompile.available);assert.equal((await api('compile-scenarios',{})).status,409);});
 await fixture(root=>script(root),async(root,api,cfg)=>{fs.writeFileSync(path.join(root,'album.project.json'),JSON.stringify(cfg));assert.equal((await api('compile-scenarios',{})).status,409);assert(!fs.existsSync(path.join(root,'scenarios.js')));});
 await fixture(root=>script(root),async(root,api)=>{fs.appendFileSync(path.join(root,'album.config.js'),'\n// external edit');assert.equal((await api('compile-scenarios',{})).status,409);assert(!fs.existsSync(path.join(root,'scenarios.js')));});
 await fixture((root,cfg)=>{script(root,'[p]');cfg.chapters=[{title:'Empty',file:'01.ks'}];},async(root,api)=>{assert.equal((await api('compile-scenarios',{})).status,400);assert(!fs.existsSync(path.join(root,'scenarios.js')));});
 await fixture(()=>{},async(root,api)=>{assert(!(await api('project')).value.scenarioCompile.available);assert.equal((await api('compile-scenarios',{})).status,409);});
 console.log('PASS: initial compile/import, existing inline-page preservation, saved/unsaved guards, stale requests, config edits, invalid scripts and no-input state.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
