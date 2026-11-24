'use strict';
const $ = id => document.getElementById(id);
const token=document.querySelector('meta[name=album-token]').content;
let config,tab='album',dirty=false,timer,generation=0,pending=Promise.resolve();
let lastPreview='';
let scenarioCompile=null, compiling=false;
// UI-only state follows chapter objects when reordered; it never enters the album.
const collapsedChapters = new WeakSet();
const portraitEditors = new Set();
const pageTextInputs = new WeakMap();
const clone=value=>JSON.parse(JSON.stringify(value));
async function request(url, data, raw=false) {
  if(window.ALBUM_STUDIO_ADAPTER)return window.ALBUM_STUDIO_ADAPTER.request(url,data,raw);
  const response=await fetch(url,{method:data===undefined?'GET':'POST',headers:{'X-Album-Token':token,...(raw?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:raw?data:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw new Error(result.error || '操作できませんでした');return result;
}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function changed(){dirty=true;updateCompilePanel();$('save-state').textContent='未保存の変更';$('project-title').textContent=config.title || 'アルバム';clearTimeout(timer);timer=setTimeout(()=>preview(),700);}
function element(tag,attrs={},text) {const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
function button(label,action,attrs={}){const node=element('button',{type:'button',...attrs},label);node.onclick=action;return node;}
function field(parent,label,value,set,{type='text',hint,options}={}) {
  const wrapper=element('label',{class:'field'});wrapper.append(element('span',{},label));
  const input=element(options?'select':type==='textarea'?'textarea':'input',options || type==='textarea'?{}:{type});
  if(options)for(const [key,title]of options)input.append(element('option',{value:key},title));
  input.value=value ?? '';input.addEventListener(options?'change':'input',()=>{set(input.value);changed();});wrapper.append(input);
  if(hint)wrapper.append(element('small',{},hint));parent.append(wrapper);return input;
}
async function upload(accept, done) {
  const input=element('input',{type:'file',accept});document.body.append(input);
  input.onchange=async()=>{const file=input.files[0];if(!file)return;try{status('素材を取り込み中…');const result=await request('/api/asset?name='+encodeURIComponent(file.name),file,true);done(result);changed();render();status(result.reused?'同じ画像があるため既存ファイルを使いました':'素材を取り込みました');}catch(error){status(error.message,true);}finally{input.remove();}};
  input.oncancel=()=>input.remove();input.click();
}
function imageField(parent,label,obj,key) {
  field(parent,label,obj[key],v=>obj[key]=v,{hint:'プロジェクト内の画像パス。ファイル選択で取り込めます'});
  parent.append(button('画像ファイルを選ぶ',()=>upload('image/png,image/jpeg,image/webp,image/gif,image/avif',result=>obj[key]=result.path)));
}
function move(items,index,step){const other=index+step;if(other<0 || other>=items.length)return;[items[index],items[other]]=[items[other],items[index]];changed();render();}
function actionIcon(kind,label,action,attrs={}) {
  const control=button('',action,{...attrs,class:'icon-action'+(attrs.class?' '+attrs.class:''),title:label,'aria-label':label});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',kind==='up'?'m6 14 6-6 6 6':kind==='down'?'m6 10 6 6 6-6':'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7');
  svg.append(path);control.append(svg);return control;
}
function heading(parent,title,items,index) {
  const row=element('div',{class:'row-head'});row.append(element('h3',{},title));const actions=element('div',{class:'row-actions'});
  actions.append(actionIcon('up',title+'を上へ移動',()=>move(items,index,-1),{...(index===0?{disabled:''}:{})}),actionIcon('down',title+'を下へ移動',()=>move(items,index,1),{...(index===items.length-1?{disabled:''}:{})}),actionIcon('delete',title+'を削除',()=>{if(confirm(title+'を削除しますか？ 素材ファイルは残ります。')){items.splice(index,1);changed();render();}},{class:'remove'}));row.append(actions);parent.append(row);
}
function audioPath(result) {
  const base = config.audioBase || '';
  if (result.path.startsWith(base)) return result.path.slice(base.length);
  config.tracks.forEach(track => track.file = base + track.file);
  config.chapters.forEach(chapter => chapter.pages.forEach(page => { if (page.bgm) page.bgm = base + page.bgm; }));
  config.audioBase = '';
  return result.path;
}
function pageImagePath(result) {
  const base = config.imageBase || '';
  if (result.path.startsWith(base)) return result.path.slice(base.length);
  config.chapters.forEach(chapter => chapter.pages.forEach(page => { if (page.image) page.image = base + page.image; }));
  config.imageBase = '';
  return result.path;
}
function musicOptions(){return [['','無音'],...config.tracks.map(t=>[t.file,t.title])];}
function render() {
  document.querySelectorAll('[data-tab]').forEach(node=>{if(node.dataset.tab===tab)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
  for (const editor of portraitEditors) editor.destroy();
  portraitEditors.clear();
  const root=$('fields');root.replaceChildren();
  if(!config){root.append(element('h2',{},'シナリオの準備'),element('p',{},'上のボタンで script/ の原稿を変換すると編集を始められます'));return;}
  if(tab==='album') {
    root.append(element('h2',{},'アルバムの情報'),element('p',{},'最初に届く、タイトルと紹介文'));
    field(root,'タイトル',config.title,v=>config.title=v);
    field(root,'アーティスト・ブランド',config.brand,v=>config.brand=v);
    field(root,'紹介文',config.description,v=>config.description=v,{type:'textarea'});
    imageField(root,'ジャケット・背景画像',config,'cover');
  }
  if(tab==='tracks') {
    root.append(element('h2',{},'楽曲'),element('p',{},'曲順を整えて、右のプレイヤーで試聴'));
    config.tracks.forEach((track,index)=>{
      const group=element('section',{class:'group'});heading(group,String(index+1).padStart(2,'0')+' '+track.title,config.tracks,index);
      field(group,'曲名',track.title,v=>track.title=v);field(group,'音源ファイル',track.file,v=>track.file=v,{hint:(config.audioBase || '')+' 以下のファイル名'});
      group.append(button('音源ファイルを選ぶ',()=>upload('audio/*',result=>{track.file=audioPath(result);})));root.append(group);
    });
    root.append(button('楽曲を追加',()=>upload('audio/*',result=>{const file=audioPath(result);config.tracks.push({file,title:result.file.replace(/^[a-f0-9]+-/,'').replace(/\.[^.]+$/,'')});}),{class:'add'}));
  }
  if(tab==='story') {
    root.append(element('h2',{},'本文・シナリオ'),element('p',{},'章とページを組み立て、画像やBGMを指定'));
    const folding = element('div', {class:'chapter-folding'});
    for (const [label, open] of [['すべて開く', true], ['すべて畳む', false]]) folding.append(button(label, () => {
      config.chapters.forEach(chapter => open ? collapsedChapters.delete(chapter) : collapsedChapters.add(chapter));
      root.querySelectorAll('.chapter-group').forEach(details => details.open = open);
    }));
    root.append(folding);
    config.chapters.forEach((chapter,index)=>{
      const details = element('details', {class:'group chapter-group'});
      details.open = !collapsedChapters.has(chapter);
      const summary = element('summary');
      const title = element('span', {class:'chapter-summary-title'}, String(index+1).padStart(2,'0')+' '+chapter.title);
      summary.append(title, element('span', {class:'chapter-summary-count'}, chapter.pages.length+'ページ'));
      details.append(summary);
      details.addEventListener('toggle', () => {
        if (!details.isConnected) return;
        if (details.open) collapsedChapters.delete(chapter); else collapsedChapters.add(chapter);
      });
      const section=element('div',{class:'chapter-body'});heading(section,'章の操作',config.chapters,index);
      field(section,'章番号・見出し',chapter.act,v=>chapter.act=v);field(section,'章タイトル',chapter.title,v=>{chapter.title=v;title.textContent=String(index+1).padStart(2,'0')+' '+v;});imageField(section,'章の背景画像',chapter,'image');
      field(section,'PCの背景画像位置',chapter.desktopPosition || 'center',v=>chapter.desktopPosition=v,{options:[['center','中央ぞろえ'],['top','上ぞろえ']],hint:'PCで幕を表示するときの位置です。縦持ちの切り抜き位置とは別に設定します'});
      const crop = AlbumCropEditor.create({chapter,cover:config.cover,onChange:changed});
      portraitEditors.add(crop);section.append(crop.element);
      chapter.pages.forEach((page,pageIndex)=>{
        const block=element('div',{class:'page-editor'});heading(block,'ページ '+(pageIndex+1),chapter.pages,pageIndex);
        field(block,'話者',page.speaker,v=>page.speaker=v);
        pageTextInputs.set(page,field(block,'本文',page.text,v=>page.text=v,{type:'textarea'}));
        const choices=musicOptions();if(page.bgm && !choices.some(([file])=>file===page.bgm))choices.push([page.bgm,page.bgm+'（原稿指定）']);
        field(block,'BGM',page.bgm || '',v=>page.bgm=v || null,{options:choices});
        field(block,'ページの背景',page.backgroundColor?'color':page.image?'image':'chapter',v=>{
          if(v==='color'){page.backgroundColor='#000000';delete page.image;}
          else {delete page.backgroundColor;if(v==='chapter')delete page.image;}
          if(v!=='image')imageInput.value='';
          // Keep the image controls visible when the author first selects Image.
          backgroundFields(v);
        },{options:[['chapter','章の画像'],['image','画像'],['color','単色']]});
        const imageControls=element('div'),colorControls=element('div');
        block.append(imageControls,colorControls);
        const imageInput=field(imageControls,'ページの画像',page.image || '',v=>{page.image=v || null;delete page.backgroundColor;},{hint:(config.imageBase || '')+' 以下のファイル名。空欄なら章の画像'});
        imageControls.append(button('ページ画像を選ぶ',()=>upload('image/png,image/jpeg,image/webp,image/gif,image/avif',result=>{page.image=pageImagePath(result);delete page.backgroundColor;})));
        const colorInput=field(colorControls,'背景色',page.backgroundColor || '#000000',v=>page.backgroundColor=v,{type:'color'});
        for(const [label,value] of [['黒','#000000'],['白','#ffffff']])colorControls.append(button(label,()=>{page.backgroundColor=value;colorInput.value=value;changed();}));
        field(block,'背景の切り替え',page.transition || 'instant',v=>page.transition=v,{options:[['instant','即時'],['fade','フェード'],['crossfade','クロスフェード'],['black','黒を挟む']],hint:'このページへ入るときの背景だけに適用します。同じ背景が続く場合は再演出しません'});
        const durationPreset=field(block,'切り替え時間',String(page.transitionDuration ?? 800),v=>{
          customDuration.hidden=v!=='custom';
          if(v!=='custom'){page.transitionDuration=Number(v);durationInput.value=v;}
        },{options:[['300','短い（300ms）'],['800','標準（800ms）'],['1600','長い（1600ms）'],['custom','直接指定']],hint:'「黒を挟む」は暗転と復帰を合わせた時間です'});
        durationPreset.value=[300,800,1600].includes(page.transitionDuration ?? 800)?String(page.transitionDuration ?? 800):'custom';
        const customDuration=element('div');customDuration.hidden=durationPreset.value!=='custom';block.append(customDuration);
        const durationInput=field(customDuration,'時間（ミリ秒）',page.transitionDuration ?? 800,v=>page.transitionDuration=Number(v),{type:'number',hint:'0〜10000ms。動きを減らす設定の端末では即時に切り替えます'});
        durationInput.min='0';durationInput.max='10000';durationInput.step='1';
        const pageCropDetails = element('details', {class:'page-crop-settings'});
        pageCropDetails.append(element('summary', {}, 'このページの縦持ち画像位置'));
        pageCropDetails.append(element('p', {class:'hint'}, 'ページ画像もここで調整できます。位置の指定がなければ章の設定を引き継ぎます'));
        let pageCrop;
        pageCropDetails.addEventListener('toggle', () => {
          if (!pageCropDetails.isConnected || !pageCropDetails.open || pageCrop) return;
          pageCrop = AlbumCropEditor.create({
            chapter:page,
            getImage:() => page.image ? (config.imageBase || '') + page.image : chapter.image || config.cover || '',
            getDefaultPosition:() => chapter.portraitPosition || chapter.crop || 'center',
            resetLabel:'章の画像位置を引き継ぐ',
            onChange:changed
          });
          portraitEditors.add(pageCrop);
          pageCropDetails.append(pageCrop.element);
        });
        block.append(pageCropDetails);
        function backgroundFields(mode){imageControls.hidden=mode!=='image';colorControls.hidden=mode!=='color';pageCropDetails.hidden=mode==='color';}
        backgroundFields(page.backgroundColor?'color':page.image?'image':'chapter');
        const pageActions=element('div',{class:'page-actions'});
        pageActions.append(button('このページをプレビュー',()=>preview(index,pageIndex)));
        pageActions.append(button('後ろにページを追加',()=>{
          const inserted={speaker:page.speaker || '',text:'新しいページ',bgm:page.bgm || null};
          for(const key of ['image','portraitPosition','backgroundColor'])if(page[key])inserted[key]=page[key];
          chapter.pages.splice(pageIndex+1,0,inserted);
          changed();render();
          const input=pageTextInputs.get(inserted);input?.focus();input?.select();
        },{'aria-label':'ページ '+(pageIndex+1)+' の後に追加'}));
        block.append(pageActions);section.append(block);
      });
      section.append(button('ページを追加',()=>{chapter.pages.push({speaker:'',text:'新しいページ',bgm:null});changed();render();},{class:'add'}));details.append(section);root.append(details);
    });
    root.append(button('章を追加',()=>{config.chapters.push({act:String(config.chapters.length+1).padStart(2,'0'),title:'新しい章',pages:[{speaker:'',text:'ここに本文を書きます',bgm:null}]});changed();render();},{class:'add'}));
  }
  if(tab==='design') {
    root.append(element('h2',{},'配色・書体'),element('p',{},'作品の雰囲気を、実際の画面で選ぶ'));
    const themes=[['ocean','Ocean / 海'],['teal','Teal / 青緑'],['forest','Forest / 森'],['plum','Plum / 紫'],['paper','Paper / 紙']];
    field(root,'配色プリセット',config.colors?'custom':config.theme || 'ocean',v=>{if(v!=='custom'){delete config.colors;config.theme=v;delete config.light;}else config.colors=['#102d3b','#193c49','#afe3db','#f4f5ef'];render();},{options:[...themes,['custom','カスタム']]});
    if(config.colors){const row=element('div',{class:'colors'});['背景','パネル','アクセント','文字'].forEach((title,index)=>field(row,title,config.colors[index],v=>config.colors[index]=v,{type:'color'}));root.append(row);field(root,'背景の明るさ',config.light?'light':'dark',v=>config.light=v==='light',{options:[['dark','暗い背景'],['light','明るい背景']]});}
    field(root,'本文と見出しの書体',config.font || 'mincho',v=>config.font=v,{options:[['mincho','明朝'],['gothic','ゴシック'],['system','システム']]});
    root.append(element('p',{class:'hint'},'プレビュー内で配色・書体を変更しても制作データは変わりません。公開時の初期値はここで設定してください。'));
  }
  if(tab==='publish') {
    root.append(element('h2',{},'ビルド・公開'),element('p',{},'確認したアルバムを、公開できるフォルダへ'));
    const list=element('ol');['プレビューで試聴・ページ送りを確認','「公開用にビルド」を押す','表示された dist フォルダの中身を公開先へアップロード','公開URLで画像と音楽を確認'].forEach(text=>list.append(element('li',{},text)));root.append(list);
    root.append(element('p',{},'ビルド時に、画像と音源の有無を確認します。出力には公開用プレイヤーと使用中の素材だけを含めます。アップロード先の指定や自動送信は行いません。'));
    field(root,'作品ID',config.id,v=>config.id=v,{hint:'英数字・ハイフン・アンダースコア。既読や表示設定を作品別に保存する識別子'});
    root.append(element('p',{class:'hint'},'保存先は album.project.json。元の .ks 原稿と album.config.js は保持します。保存した制作データを次回も読み込みます。'));
  }
}
async function preview(chapter,page) {
  if(!config || compiling)return;
  clearTimeout(timer);
  const serial=++generation;
  const snapshot=clone(config);
  // Serialize preview updates so older requests cannot replace newer drafts.
  pending=pending.catch(()=>{}).then(()=>request('/api/preview',snapshot));
  try {
    await pending;if(serial!==generation)return;
    for (const editor of portraitEditors) editor.refreshImage();
    const state=JSON.stringify(snapshot);
    if(window.ALBUM_STUDIO_ADAPTER){
      if(state!==lastPreview || chapter!==undefined)await window.ALBUM_STUDIO_ADAPTER.preview(snapshot,chapter,page);
      lastPreview=state;status('プレビューを更新しました');return;
    }
    const target='/preview/index.html?v='+Date.now()+(chapter===undefined?'':'#chapter='+chapter+'&page='+page);
    if(state!==lastPreview || chapter!==undefined || !$('preview').getAttribute('src').startsWith('/preview/')){$('preview').src=target;lastPreview=state;}
    status('プレビューを更新しました');
  } catch(error){status('プレビュー未更新: '+error.message,true);}
}
async function action(kind) {
  if(!config || compiling)return;
  clearTimeout(timer);++generation;
  $('save').disabled=$('build').disabled=true;
  const snapshot=clone(config);
  try {
    await pending.catch(()=>{});
    status(kind==='build'?'公開用ファイルを作成中…':'保存中…');
    const result=await request('/api/'+kind,snapshot);
    scenarioCompile={available:false};updateCompilePanel();
    dirty=JSON.stringify(config)!==JSON.stringify(snapshot);$('save-state').textContent=dirty?'未保存の変更':'保存済み';
    if(kind==='build'){$('output-path').textContent=result.folder;$('output-count').textContent=result.files+' ファイルを書き出しました';$('build-result').showModal();status('ビルドが完了しました');}
    else status('制作データを保存しました');
  }catch(error){status(error.message,true);}finally{$('save').disabled=$('build').disabled=false;}
}
$('form').onsubmit=event=>event.preventDefault();
document.querySelectorAll('[data-tab]').forEach(node=>node.onclick=()=>{tab=node.dataset.tab;render();});
$('save').onclick=()=>action('save');$('build').onclick=()=>action('build');
$('refresh').onclick=()=>{lastPreview='';preview();};
$('close-result').onclick=()=>$('build-result').close();
for (const mode of ['wide', 'narrow', 'landscape']) $(mode).onclick = () => {
  $('preview-stage').classList.toggle('mobile', mode === 'narrow');
  $('preview-stage').classList.toggle('landscape', mode === 'landscape');
  for (const id of ['wide', 'narrow', 'landscape']) $(id).setAttribute('aria-pressed', String(id === mode));
};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
function updateCompilePanel(){
  $('scenario-compile-panel').hidden=!scenarioCompile?.available;
  $('compile-scenarios').disabled=dirty || compiling;
  $('compile-scenarios').textContent=compiling?'変換中…':'シナリオをコンパイル';
  $('scenario-compile-info').textContent=dirty?'未保存の編集を保護するため実行できません。現在の内容を保存してください':('script/ の '+(scenarioCompile?.files?.length || 0)+' ファイルを scenarios.js に変換します');
}
$('compile-scenarios').onclick=async()=>{
  if(dirty || compiling || !scenarioCompile?.available)return;
  clearTimeout(timer);++generation;compiling=true;updateCompilePanel();
  $('fields').inert=true;document.querySelector('nav').inert=true;
  $('save').disabled=$('build').disabled=$('refresh').disabled=true;
  let completionMessage;
  try{
    await pending.catch(()=>{});
    const result=await request('/api/compile-scenarios',{});
    config=result.config;scenarioCompile=result.scenarioCompile;dirty=result.imported;
    $('project-title').textContent=config.title;
    $('save-state').textContent=dirty?'原稿を取り込み済み・未保存':'変更なし';
    completionMessage=result.imported ? result.count+' ファイルを取り込みました。内容を確認して保存してください' : 'scenarios.js を作成しました。入力済み本文は保持しています。原稿を使う章は作品設定の file で指定してください';
    render();
  }catch(error){status(error.message,true);}
  finally{
    compiling=false;updateCompilePanel();$('fields').inert=false;document.querySelector('nav').inert=false;
    $('save').disabled=$('build').disabled=$('refresh').disabled=!config;
    if(config)await preview();
    if(completionMessage)status(completionMessage);
  }
};
request('/api/project').then(data=>{
  config=data.config;scenarioCompile=data.scenarioCompile;
  $('project-title').textContent=config?.title || 'シナリオの準備';$('project-location').textContent=data.root;$('save-state').textContent='変更なし';
  $('save').disabled=$('build').disabled=$('refresh').disabled=!config;
  updateCompilePanel();render();if(config)preview();else status('script/ の原稿をコンパイルしてください');
}).catch(error=>status(error.message,true));
