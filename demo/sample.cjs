'use strict';
// Original demonstration assets, generated only from this source. MIT licensed.
const zlib=require('node:zlib');
const {crc32}=require('./zip.js');
function png(variant){
 const width=960,height=540,raw=Buffer.alloc((width*3+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const horizon=.48+Math.sin(x/190+variant)*.045,water=y/height>horizon;
  const t=y/height,glow=Math.max(0,1-Math.hypot((x-width*.7)/360,(y-height*.27)/230));
  const palettes=variant?[[29,44,72],[69,92,120],[224,162,121]]:[[107,171,183],[26,83,105],[255,237,181]];
  const base=palettes[water?1:0],shine=palettes[2],ripple=water?Math.sin(y*.25+x*.014)*5:0;
  const i=y*(width*3+1)+1+x*3;
  for(let c=0;c<3;c++)raw[i+c]=Math.max(0,Math.min(255,base[c]*(1-glow*.45)+shine[c]*glow*.45+ripple+(water?-t*8:0)));
 }
 function chunk(name,body){const type=Buffer.from(name),out=Buffer.alloc(body.length+12);out.writeUInt32BE(body.length);type.copy(out,4);body.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,body])),8+body.length);return out;}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function wav(variant){
 const rate=22050,seconds=12,count=rate*seconds,out=Buffer.alloc(44+count*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
 const notes=variant?[220,261.63,329.63,392]:[261.63,329.63,392,523.25];
 for(let i=0;i<count;i++){const t=i/rate,beat=t%.75,note=notes[Math.floor(t/.75)%notes.length];const envelope=(1-Math.exp(-beat*50))*Math.exp(-beat*4);const tail=Math.min(1,t,seconds-t);let s=Math.sin(2*Math.PI*note*t)*envelope*.25+Math.sin(2*Math.PI*notes[0]/2*t)*.06;out.writeInt16LE(Math.round(s*tail*28000),44+i*2);}return out;
}
const config={id:'album-kit-sample',title:'波間のノート',brand:'Album Kit / Sample',description:'音楽と短い物語を組み合わせた、Album Kitのオリジナルサンプルです。',theme:'ocean',font:'mincho',cover:'image/morning.png',imageBase:'image/',audioBase:'mp3/',tracks:[{file:'morning.wav',title:'Morning / 朝のスケッチ'},{file:'evening.wav',title:'Evening / 帰り道'}],chapters:[
 {act:'01',title:'朝の海',image:'image/morning.png',pages:[{speaker:'',text:'窓を開けると、潮の香りがした。',bgm:'morning.wav'},{speaker:'旅人',text:'今日は、遠回りをして帰ろう。',bgm:'morning.wav'},{speaker:'',text:'波の音を、しばらく聴いていた。',bgm:'morning.wav'}]},
 {act:'02',title:'夕暮れと余白',image:'image/evening.png',pages:[{speaker:'',text:'日が沈むころ、音楽は違う色に聴こえた。',bgm:'evening.wav'},{speaker:'',text:'目を閉じて、今日の景色を思い出す。',bgm:'evening.wav',backgroundColor:'#000000',transition:'fade',transitionDuration:800},{speaker:'',text:'灯りがひとつ、海辺の道にともった。',bgm:'evening.wav',transition:'fade',transitionDuration:800}]}
]};
function assets(){return new Map([['image/morning.png',png(0)],['image/evening.png',png(1)],['mp3/morning.wav',wav(0)],['mp3/evening.wav',wav(1)]]);}
module.exports={config,assets};
