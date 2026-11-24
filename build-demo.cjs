'use strict';
const fs=require('node:fs'),path=require('node:path');
const {config,assets}=require('./demo/sample.cjs'),{zip}=require('./demo/zip.js');
const libraryFiles=['base.css','theme.css','template.js','setup.js','player.js','studio.js','studio.css','studio.html','studio.cjs','crop-editor.js','project.cjs','build-scenarios.cjs','create.cjs','create-album.bat','create-album.command','open-studio.bat','open-studio.command','README.md','WORKFLOW.md','LICENSE','THIRD_PARTY_NOTICES.md','branding/favicon.svg','branding/favicon.ico','branding/apple-touch-icon.png'];
function buildDemo(output=path.join(__dirname,'_site')){
 output=path.resolve(output);fs.mkdirSync(output,{recursive:true});
 const write=(name,content)=>{const file=path.join(output,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);};
 const projectFiles=new Map([['index.html',fs.readFileSync(path.join(__dirname,'starter.html'))],['album.config.js','window.ALBUM_CONFIG = '+JSON.stringify(config,null,2)+';\n'],['album.project.json',JSON.stringify(config,null,2)+'\n'],['LICENSE',fs.readFileSync(path.join(__dirname,'LICENSE'))],['SAMPLE-README.txt','Album Kit オリジナルサンプル（本文・生成画像・合成音源を含めMIT）。\nNode.js 22以上を用意し album-kit/open-studio.bat または open-studio.command で制作室を開きます。\nscript/example.ks は記法の見本です。保存済みJSONが優先されるので、原稿は自動では取り込みません。\n'],['script/example.ks','#旅人\n[playbgm storage="morning.wav"]\n朝の海へ出かけよう。[p]\n[bg color="black" effect="fade" time="800"]\n静かな余白。[p]\n[bg effect="fade" time="800"]\n窓の外が明るくなった。[p]\n']]);
 for(const file of libraryFiles){const bytes=fs.readFileSync(path.join(__dirname,file));projectFiles.set('album-kit/'+file,bytes);write('assets/album-kit/'+file,bytes);}
 for(const [file,bytes] of assets())projectFiles.set(file,bytes);
 for(const [file,content]of projectFiles)write('project/'+file,content);
 for(const [file,content]of projectFiles)if(file==='index.html'||file==='album.config.js'||file==='LICENSE'||file.startsWith('image/')||file.startsWith('mp3/')||require('./project.cjs').runtime.some(r=>file==='album-kit/'+r))write('sample/'+file,content);
 write('album-kit-sample.zip',zip([...projectFiles]));
 write('sample.json',JSON.stringify(config));write('project-manifest.json',JSON.stringify({files:[...projectFiles.keys()].filter(p=>!p.startsWith('image/')&&!p.startsWith('mp3/')&&!['album.config.js','album.project.json'].includes(p))}));
 write('LICENSE',fs.readFileSync(path.join(__dirname,'LICENSE')));write('.nojekyll','');
 write('assets/album-kit/zip.js',fs.readFileSync(path.join(__dirname,'demo/zip.js')));write('studio/adapter.js',fs.readFileSync(path.join(__dirname,'demo/adapter.js')));
 let html=fs.readFileSync(path.join(__dirname,'studio.html'),'utf8').replace('__ALBUM_TOKEN__','static-demo').replaceAll('href="/branding/','href="../assets/album-kit/branding/').replace('href="/studio.css"','href="../assets/album-kit/studio.css"').replace('<script src="/crop-editor.js" defer></script>','<script src="adapter.js" defer></script><script src="../assets/album-kit/setup.js" defer></script><script src="../assets/album-kit/zip.js" defer></script><script src="../assets/album-kit/crop-editor.js" defer></script>').replace('src="/studio.js"','src="../assets/album-kit/studio.js"');
 html=html.replace('<title>Album Kit — 制作室</title>','<title>Album Kit — 制作室を試す</title>');write('studio/index.html',html);
 write('index.html',fs.readFileSync(path.join(__dirname,'demo/index.html')));
 return {output,files:projectFiles.size};
}
module.exports={buildDemo,libraryFiles};
if(require.main===module)console.log(buildDemo(process.argv[2]));
