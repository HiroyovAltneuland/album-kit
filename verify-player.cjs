'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseScenario}=require('./player.js');
const {validate}=require('./setup.js');
assert.deepEqual(parseScenario('#Artist\nFirst page.[p]\nSecond page.'),[{speaker:'Artist',text:'First page.',bgm:null,image:null},{speaker:'Artist',text:'Second page.',bgm:null,image:null}]);
assert.equal(parseScenario('Artist\nNotes',['Artist'])[0].speaker,'Artist');
assert.equal(parseScenario('[playbgm storage="song.mp3"]First[p][stopbgm]Second')[1].bgm,null);
class Element {
 constructor(){this.children=[];this.style={setProperty(k,v){this[k]=v;}};this.classList={add(){},remove(){},toggle(){}};this.handlers={};this.open=false;}
 append(...children){this.children.push(...children);}addEventListener(k,f){this.handlers[k]=f;}click(){this.handlers.click?.();}setAttribute(){}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 querySelectorAll(){return this.children.map(child=>child.children[1].children[2]);}
}
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
let audio;
class Audio {
 constructor(){audio=this;this.handlers={};this.duration=NaN;this.currentTime=0;}
 addEventListener(k,f){this.handlers[k]=f;}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){this.duration=NaN;this.currentTime=0;}
}
const config={id:'test',title:'Album',audioBase:'mp3/',imageBase:'image/',tracks:[{file:'one.mp3',title:'One'},{file:'two.mp3',title:'Two'}],chapters:[{act:'01',title:'Notes',image:'image/cover.png',desktopPosition:'top',portraitPosition:'25% 50%',pages:[{text:'First',bgm:'one.mp3',portraitPosition:'63.7% 50%'},{text:'Second',bgm:null}]},{act:'02',title:'Credits',pages:[{text:'End'}]}]};
validate(config);
const context={window:{ALBUM_CONFIG:config},URL,Audio,document:{baseURI:'https://example.test/album/index.html',getElementById:el,createElement:()=>new Element(),addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('./player.js'),'utf8'),context);
assert.equal(el('chapters').children.length,2);
el('chapters').children[0].click();assert.equal(el('message').textContent,'First');assert.equal(el('game').style['--desktop-scene-position'],'center top');assert.equal(el('game').style['--scene-image'],'url("https://example.test/album/image/cover.png")');assert.equal(el('game').style['--portrait-focus'],'63.7% 50%');
el('next').click();assert.equal(el('message').textContent,'Second');assert.equal(el('game').style['--portrait-focus'],'25% 50%');
el('next').click();assert(el('next-dialog').open);el('yes').click();assert.equal(el('message').textContent,'End');assert.equal(el('game').style['--desktop-scene-position'],'center center');el('next').click();assert.equal(el('menu').hidden,false);
el('music-track').value='one.mp3';el('music-play').click();audio.duration=100;audio.handlers.loadedmetadata();el('music-seek').handlers.input({target:{value:'42'}});assert.equal(audio.currentTime,42);
audio.handlers.ended();assert.equal(el('music-track').value,'two.mp3');el('music-mode').click();assert.equal(audio.loop,true);audio.handlers.ended();assert.equal(el('music-track').value,'two.mp3');
console.log('PASS: scenario parsing, chapter transitions, artwork URLs, page crop inheritance, audio seeking and repeat.');

assert.throws(()=>validate({...config,chapters:[{title:'Invalid',desktopPosition:'invalid',pages:[{text:'Note'}]}]}),/center/);

const colored=parseScenario('#Artist\nBefore[p]\n[bg color="black" effect="fade" time="800"]Dark[p]Still dark[p]\n[image storage="scene.png" effect="black" time="1600"]Back');
assert.equal(colored[1].backgroundColor,'#000000');assert.equal(colored[1].transition,'fade');assert.equal(colored[1].transitionDuration,800);
assert.equal(colored[2].backgroundColor,'#000000');assert.equal(colored[2].transition,undefined);
assert.equal(colored[3].backgroundColor,undefined);assert.equal(colored[3].image,'scene.png');assert.equal(colored[3].transition,'black');
assert.equal(parseScenario('[bg color="white"]White')[0].backgroundColor,'#ffffff');
assert.equal(parseScenario('[bg]Default')[0].image,null);
for(const invalid of [{backgroundColor:'red'},{backgroundColor:'#000; url(x)'},{transition:'unknown'},{transitionDuration:NaN},{transitionDuration:-1},{transitionDuration:10001}])
 assert.throws(()=>validate({...config,chapters:[{title:'Invalid',pages:[{text:'Note',...invalid}]}]}));

config.chapters[0].pages.push({text:'Dark',backgroundColor:'#000000',transition:'fade',transitionDuration:800},{text:'White',backgroundColor:'#ffffff'},{text:'Restored'});
el('chapters').children[0].click();el('next').click();el('next').click();
assert.equal(el('game').style['--scene-image'],'none');assert.equal(el('game').style['--scene-color'],'#000000');assert.equal(el('reading-area').hidden,false);assert.equal(el('message').textContent,'Dark');
el('next').click();assert.equal(el('game').style['--scene-color'],'#ffffff');
el('next').click();assert.equal(el('game').style['--scene-color'],'transparent');assert.equal(el('game').style['--scene-image'],'url("https://example.test/album/image/cover.png")');
el('previous').click();assert.equal(el('game').style['--scene-color'],'#ffffff');
console.log('PASS: color background tags, effect validation, immediate fallback, backward navigation and image restoration.');

async function checkAnimations(){
 const active=[];let removed=0;
 Element.prototype.remove=function(){removed++;};
 Element.prototype.animate=function(frames,options){
  let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});
  const animation={finished,frames,options,resolve,cancel(){reject(new Error('Cancelled'));}};
  active.push(animation);return animation;
 };
 nodes.clear();
 const animated={...config,chapters:[{act:'01',title:'Effects',image:'image/cover.png',pages:[
  {text:'Image'}, {text:'Black',backgroundColor:'#000000',transition:'fade',transitionDuration:800},
  {text:'Same black',backgroundColor:'#000000',transition:'fade'},
  {text:'White',backgroundColor:'#ffffff',transition:'black',transitionDuration:1600},
  {text:'Image again',transition:'crossfade',transitionDuration:300}
 ]}]};
 const animatedContext={...context,window:{ALBUM_CONFIG:animated},getComputedStyle:()=>({background:'rgb(0, 0, 0)',borderRadius:'8px',top:'0px',filter:'none',transform:'none'}),document:{...context.document,querySelector:()=>el('backdrop')}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./player.js'),'utf8'),animatedContext);
 el('chapters').children[0].click();el('next').click();
 assert.equal(active.length,2);assert.equal(active[0].options.duration,800);assert.equal(el('game').style['--scene-color'],'#000000');
 // Rapid next cancels both overlays; an identical background creates no animation.
 el('next').click();assert.equal(active.length,2);assert.equal(removed,2);
 el('next').click();assert.equal(active.length,4);assert.equal(active[2].frames[0].opacity,0);assert.equal(el('game').style['--scene-color'],'#000000');
 active[2].resolve();active[3].resolve();
 for(let i=0;i<6;i++)await Promise.resolve();
 assert.equal(el('game').style['--scene-color'],'#ffffff');assert.equal(active.length,6);assert.equal(active[4].frames[0].opacity,1);
 // Interrupt black's return phase by moving to another background.
 el('next').click();assert.equal(el('game').style['--scene-color'],'transparent');assert.equal(active.length,8);
 el('menu-button').click();assert.equal(el('menu').hidden,false);assert.equal(removed,6);
 for(let i=0;i<6;i++)await Promise.resolve();
 assert.equal(el('menu').hidden,false);
 console.log('PASS: animated fades, black midpoint, unchanged backgrounds, rapid navigation cancellation and menu cleanup.');
}
checkAnimations().catch(error=>{console.error(error);process.exitCode=1;});
