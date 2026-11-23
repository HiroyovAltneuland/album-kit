(function(root){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(100,n));
  function parsePosition(value='center') {
    let parts=String(value).trim().toLowerCase().split(/\s+/);
    if(parts.length===1 && /^(top|bottom)$/.test(parts[0]))parts=['center',parts[0]];
    if(/^(top|bottom)$/.test(parts[0]))parts.reverse();
    const percent=(token,axis)=>{
      if(token==='center' || token===undefined)return 50;
      if(token===(axis==='x'?'left':'top'))return 0;
      if(token===(axis==='x'?'right':'bottom'))return 100;
      return /^\d+(?:\.\d+)?%$/.test(token)?clamp(parseFloat(token)):50;
    };
    return {x:percent(parts[0],'x'),y:percent(parts[1],'y')};
  }
  function frame(width,height,x,y) {
    const size=Math.min(width,height);
    return {size,left:(width-size)*clamp(x)/100,top:(height-size)*clamp(y)/100};
  }
  function positionAt(width,height,left,top) {
    const size=Math.min(width,height);
    return {x:width>size?clamp(left/(width-size)*100):50,y:height>size?clamp(top/(height-size)*100):50};
  }
  function create({chapter,cover,onChange,getImage,getDefaultPosition,resetLabel='サムネイルと共通に戻す'}) {
    const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
    const root=make('div','portrait-editor');
    root.append(make('h3','','縦持ちの画像位置'),make('p','hint','正方形の枠をドラッグして、見せたい範囲を選びます'));
    const board=make('div','crop-board');
    const img=make('img');img.alt='切り抜き位置を調整する元画像';img.draggable=false;img.loading='lazy';
    const box=make('div','crop-frame');box.setAttribute('aria-hidden','true');
    board.append(img,box);root.append(board);
    const hint=make('p','hint');root.append(hint);
    const fallback = () => getDefaultPosition ? getDefaultPosition() : chapter.crop || 'center';
    let position=parsePosition(chapter.portraitPosition || fallback()),drag=null;
    const controls={};
    for(const [axis,label]of [['x','横位置'],['y','縦位置']]){
      const row=make('label','crop-axis');row.append(make('span','',label));
      const input=make('input');input.type='range';input.min='0';input.max='100';input.step='0.1';
      const output=make('output');row.append(input,output);root.append(row);controls[axis]={input,output};
      input.addEventListener('input',()=>{position[axis]=Number(input.value);commit();});
    }
    function draw(){
      const w=board.clientWidth,h=board.clientHeight;
      if(w && h){const f=frame(w,h,position.x,position.y);box.style.width=f.size+'px';box.style.height=f.size+'px';box.style.left=f.left+'px';box.style.top=f.top+'px';}
      for(const axis of ['x','y']){controls[axis].input.value=position[axis];controls[axis].output.textContent=position[axis].toFixed(1)+'%';controls[axis].input.disabled=!img.naturalWidth || (axis==='x'?img.naturalWidth<=img.naturalHeight:img.naturalHeight<=img.naturalWidth);}
    }
    function commit(){chapter.portraitPosition=position.x.toFixed(1)+'% '+position.y.toFixed(1)+'%';draw();onChange();}
    board.addEventListener('pointerdown',event=>{
      if(!img.naturalWidth || (event.pointerType==='mouse' && event.button!==0))return;
      const rect=board.getBoundingClientRect(),f=frame(rect.width,rect.height,position.x,position.y);
      const x=event.clientX-rect.left,y=event.clientY-rect.top;
      const inside=x>=f.left && x<=f.left+f.size && y>=f.top && y<=f.top+f.size;
      drag={id:event.pointerId,dx:inside?x-f.left:f.size/2,dy:inside?y-f.top:f.size/2};
      board.setPointerCapture(event.pointerId);update(event);
    });
    function update(event){if(!drag || drag.id!==event.pointerId)return;const rect=board.getBoundingClientRect();position=positionAt(rect.width,rect.height,event.clientX-rect.left-drag.dx,event.clientY-rect.top-drag.dy);commit();}
    board.addEventListener('pointermove',update);
    board.addEventListener('pointerup',()=>drag=null);board.addEventListener('pointercancel',()=>drag=null);board.addEventListener('lostpointercapture',()=>drag=null);
    const reset=make('button','',resetLabel);reset.type='button';reset.onclick=()=>{delete chapter.portraitPosition;position=parsePosition(fallback());draw();onChange();};root.append(reset);
    img.onload=()=>{hint.textContent='枠の外側はトリミングされます。画像の比率によって動かせる方向が変わります';draw();};
    img.onerror=()=>{hint.textContent='画像を読み込めません。画像パスを確認してください';draw();};
    const observer=new ResizeObserver(()=>{if(board.isConnected)draw();});observer.observe(board);
    let lastPath='';
    function refreshImage(){
      const file=getImage ? getImage() : chapter.image || cover || '';
      board.hidden=!file;
      if(!file){hint.textContent='画像を指定すると位置を調整できます';draw();return;}
      if(file!==lastPath || (img.complete && !img.naturalWidth)){lastPath=file;img.src='/preview/'+file.split('/').map(encodeURIComponent).join('/')+'?crop='+Date.now();}
    }
    refreshImage();draw();
    return {element:root,refreshImage,destroy(){observer.disconnect();}};
  }
  const api={parsePosition,frame,positionAt,create};
  if(typeof module!=='undefined')module.exports=api;
  else root.AlbumCropEditor=api;
})(typeof window!=='undefined'?window:globalThis);
