'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {validate} = require('./setup.js');
const {parseScenario} = require('./player.js');
const runtime = ['base.css','theme.css','template.js','setup.js','player.js'];
function local(root, value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f?#:]/.test(value) || value.startsWith('/') || value.split('/').some(p => p === '..' || p === '.')) throw new Error('素材にはプロジェクト内の相対パスを指定してください: ' + value);
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('プロジェクト外の素材です');
  // Do not follow symbolic links, including those on Windows.
  let part = root;
  for (const segment of relative.split(path.sep)) { part = path.join(part,segment); if (fs.existsSync(part) && fs.lstatSync(part).isSymbolicLink()) throw new Error('リンクされた素材は使用できません'); }
  return absolute;
}
function load(root, {scenarioSources} = {}) {
  const json = path.join(root,'album.project.json');
  if (fs.existsSync(json)) return JSON.parse(fs.readFileSync(json,'utf8').replace(/^\uFEFF/,''));
  const context = {window:{}};
  vm.createContext(context);
  for (const file of ['album.config.js','scenarios.js']) if (fs.existsSync(path.join(root,file))) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{timeout:1000});
  const config = JSON.parse(JSON.stringify(context.window.ALBUM_CONFIG));
  if (scenarioSources) context.window.SCENARIO_SOURCES = scenarioSources;
  validate(config,context.window.SCENARIO_SOURCES);
  config.chapters = config.chapters.map(chapter => {
    const item = {...chapter,pages:chapter.pages || parseScenario(context.window.SCENARIO_SOURCES[chapter.file],config.speakers)};
    delete item.file; return item;
  });
  return config;
}
function check(config) {
  validate(config);
  for (const chapter of config.chapters) if (!chapter.pages) throw new Error('制作ツールでは pages 形式の本文が必要です');
  return config;
}
function save(root, config) {
  check(config);
  const target = local(root,'album.project.json');
  const temp = local(root,'album.project.json.tmp');
  fs.writeFileSync(temp,JSON.stringify(config,null,2)+'\n',{flag:'w'});
  fs.renameSync(temp,target);
}
function assets(config) {
  const paths = new Set();
  const add = value => { if(value) paths.add(value); };
  add(config.cover);
  for (const track of config.tracks) add((config.audioBase || '')+track.file);
  for (const chapter of config.chapters) {
    add(chapter.image);
    for (const page of chapter.pages) {
      if (page.bgm) add((config.audioBase || '')+page.bgm);
      if (page.image) add((config.imageBase || '')+page.image);
    }
  }
  return [...paths];
}
function build(root, config) {
  check(config);
  const files = assets(config);
  // Validate the entire project before making any output.
  for (const file of files) {
    const full = local(root,file);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error('素材が見つかりません: '+file);
    if (!/\.(mp3|wav|ogg|m4a|aac|flac|png|jpe?g|webp|gif|avif)$/i.test(file)) throw new Error('非対応の素材です: '+file);
    if (file.startsWith('album-kit/')) throw new Error('素材は album-kit の外に配置してください');
  }
  const name = new Date().toISOString().replace(/[:.]/g,'-')+'-'+require('node:crypto').randomBytes(3).toString('hex');
  const output = local(root,'dist/'+name);
  fs.mkdirSync(path.join(output,'album-kit'),{recursive:true});
  for (const file of runtime) fs.copyFileSync(path.join(__dirname,file),path.join(output,'album-kit',file));
  const escape = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const html = fs.readFileSync(path.join(__dirname,'starter.html'),'utf8').replace('<title>New Album</title>','<title>'+escape(config.title)+'</title>');
  fs.writeFileSync(path.join(output,'index.html'),html);
  fs.copyFileSync(path.join(__dirname,'LICENSE'),path.join(output,'LICENSE'));
  fs.writeFileSync(path.join(output,'album.config.js'),'window.ALBUM_CONFIG = '+JSON.stringify(config,null,2)+';\n');
  for (const file of files) {
    const destination = path.join(output,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(local(root,file),destination);
  }
  return {folder:'dist/'+name,files:files.length+runtime.length+3};
}
module.exports = {local,load,check,save,assets,build,runtime};
if (require.main === module) {
  try { const root=path.resolve(process.argv[2] || path.join(__dirname,'..')); console.log(build(root,load(root))); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
