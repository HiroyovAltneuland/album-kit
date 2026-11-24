const assert=require('node:assert/strict');
const {parsePosition,frame,positionAt}=require('./crop-editor.js');
assert.deepEqual(parsePosition('20%'),{x:20,y:50});
assert.deepEqual(parsePosition('right center'),{x:100,y:50});
assert.deepEqual(parsePosition('top left'),{x:0,y:0});
assert.deepEqual(parsePosition('bottom'),{x:50,y:100});
assert.deepEqual(parsePosition('33.3% 75.5%'),{x:33.3,y:75.5});
assert.deepEqual(frame(400,225,50,50),{size:225,left:87.5,top:0});
assert.deepEqual(frame(225,400,25,100),{size:225,left:0,top:175});
assert.deepEqual(positionAt(400,225,87.5,0),{x:50,y:50});
assert.deepEqual(positionAt(225,400,0,175),{x:50,y:100});
assert.deepEqual(positionAt(400,225,-100,1000),{x:0,y:50});
assert.deepEqual(positionAt(400,225,1000,1000),{x:100,y:50});
assert.deepEqual(positionAt(300,300,100,100),{x:50,y:50});
for(const [w,h]of [[1920,1080],[1080,1920],[1000,1000]])for(const value of [0,16.7,50,80.2,100]){
 const f=frame(w,h,value,value),p=positionAt(w,h,f.left,f.top);
 if(w>h)assert(Math.abs(p.x-value)<1e-10);
 if(h>w)assert(Math.abs(p.y-value)<1e-10);
 assert(f.left>=0 && f.left+f.size<=w && f.top>=0 && f.top+f.size<=h);
}
console.log('PASS: legacy positions, precise percentages, square crop geometry, portrait/landscape drag bounds and CSS-position round trips.');

// Page crop edits must stay on the page, inherit dynamically and reset cleanly.
{
  const {create}=require('./crop-editor.js');
  class Node {
    constructor(){this.children=[];this.style={};this.handlers={};this.clientWidth=400;this.clientHeight=225;this.naturalWidth=1600;this.naturalHeight=900;this.complete=true;}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(){}
    addEventListener(name,callback){this.handlers[name]=callback;}
  }
  global.document={createElement:()=>new Node()};
  global.ResizeObserver=class{observe(){} disconnect(){this.disconnected=true;}};
  const page={image:'挿絵 one.png'},parent={portraitPosition:'25% 50%'};let changes=0;
  const editor=create({chapter:page,getImage:()=> 'art/'+page.image,getDefaultPosition:()=>parent.portraitPosition,resetLabel:'章の画像位置を引き継ぐ',onChange(){changes++;}});
  const root=editor.element,board=root.children[2],image=board.children[0],x=root.children[4].children[1];
  assert.equal(x.value,25);
  assert(image.src.includes('/preview/art/%E6%8C%BF%E7%B5%B5%20one.png'));
  x.value='63.7';x.handlers.input();
  assert.equal(page.portraitPosition,'63.7% 50.0%');
  assert.equal(parent.portraitPosition,'25% 50%');
  parent.portraitPosition='70% 50%';root.children.at(-1).onclick();
  assert.equal(page.portraitPosition,undefined);assert.equal(x.value,70);
  page.image='second.png';editor.refreshImage();assert(image.src.includes('/preview/art/second.png'));
  global.ALBUM_STUDIO_ADAPTER={assetURL:file=>'https://example.test/album-kit/sample/'+file};
  page.image='hosted.png';editor.refreshImage();assert.equal(image.src,'https://example.test/album-kit/sample/art/hosted.png');
  global.ALBUM_STUDIO_ADAPTER.assetURL=()=> 'blob:uploaded-image';
  page.image='uploaded.png';editor.refreshImage();assert.equal(image.src,'blob:uploaded-image');
  const chapterCrop=create({chapter:{image:'image/cover.png'},onChange(){}});
  assert.equal(chapterCrop.element.children[2].children[0].src,'blob:uploaded-image');chapterCrop.destroy();
  delete global.ALBUM_STUDIO_ADAPTER;
  assert.equal(changes,2);editor.destroy();
  delete global.document;delete global.ResizeObserver;
  console.log('PASS: page-only crop edits, inherited chapter position, reset, custom image base and image replacement.');
}
