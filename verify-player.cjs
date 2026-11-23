'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseScenario}=require('./player.js');
const {validate}=require('./setup.js');
assert.deepEqual(parseScenario('#Artist\nFirst page.[p]\nSecond page.'),[{speaker:'Artist',text:'First page.',bgm:null,image:null},{speaker:'Artist',text:'Second page.',bgm:null,image:null}]);
assert.equal(parseScenario('Artist\nNotes',['Artist'])[0].speaker,'Artist');
assert.equal(parseScenario('[playbgm storage="song.mp3"]First[p][stopbgm]Second')[1].bgm,null);
class Element {
 constructor(){this.children=[];this.style={setProperty(k,v){this[k]=v;}};this.classList={add(){},remove(){}};this.handlers={};this.open=false;}
 append(...children){this.children.push(...children);}addEventListener(k,f){this.handlers[k]=f;}click(){this.handlers.click?.();}setAttribute(){}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 querySelectorAll(){return this.children.map(child=>child.children[1].children[2]);}
}
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
let audio;
class Audio {
 constructor(){audio=this;this.handlers={};this.duration=NaN;this.currentTime=0;}
 addEventListener(k,f){this.handlers[k]=f;}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){this.duration=NaN;this.currentTime=0;}
}
const config={id:'test',title:'Album',audioBase:'mp3/',imageBase:'image/',tracks:[{file:'one.mp3',title:'One'},{file:'two.mp3',title:'Two'}],chapters:[{act:'01',title:'Notes',image:'image/cover.png',portraitPosition:'25% 50%',pages:[{text:'First',bgm:'one.mp3',portraitPosition:'63.7% 50%'},{text:'Second',bgm:null}]},{act:'02',title:'Credits',pages:[{text:'End'}]}]};
validate(config);
const context={window:{ALBUM_CONFIG:config},URL,Audio,document:{baseURI:'https://example.test/album/index.html',getElementById:el,createElement:()=>new Element(),addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('./player.js'),'utf8'),context);
assert.equal(el('chapters').children.length,2);
el('chapters').children[0].click();assert.equal(el('message').textContent,'First');assert.equal(el('game').style['--scene-image'],'url("https://example.test/album/image/cover.png")');assert.equal(el('game').style['--portrait-focus'],'63.7% 50%');
el('next').click();assert.equal(el('message').textContent,'Second');assert.equal(el('game').style['--portrait-focus'],'25% 50%');
el('next').click();assert(el('next-dialog').open);el('yes').click();assert.equal(el('message').textContent,'End');el('next').click();assert.equal(el('menu').hidden,false);
el('music-track').value='one.mp3';el('music-play').click();audio.duration=100;audio.handlers.loadedmetadata();el('music-seek').handlers.input({target:{value:'42'}});assert.equal(audio.currentTime,42);
audio.handlers.ended();assert.equal(el('music-track').value,'two.mp3');el('music-mode').click();assert.equal(audio.loop,true);audio.handlers.ended();assert.equal(el('music-track').value,'two.mp3');
console.log('PASS: scenario parsing, chapter transitions, artwork URLs, page crop inheritance, audio seeking and repeat.');
