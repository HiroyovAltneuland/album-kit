(function (root) {
  'use strict';
  // Four-color presets inspired by Color Hunt. No external requests or fonts.
  const palettes = {
    ocean: { label: 'Ocean / 海', colors: ['#102d3b','#193c49','#afe3db','#f4f5ef'] },
    teal: { label: 'Teal / 青緑', colors: ['#222831','#393e46','#00adb5','#eeeeee'], source: 'https://colorhunt.co/palette/222831393e4600adb5eeeeee' },
    forest: { label: 'Forest / 森', colors: ['#1a3636','#40534c','#d6bd98','#f4f2e9'] },
    plum: { label: 'Plum / 紫', colors: ['#352f44','#5c5470','#b9b4c7','#faf0e6'] },
    paper: { label: 'Paper / 紙', colors: ['#faf7f0','#f0e9dc','#784f35','#302b27'], light: true }
  };
  const fonts = {
    mincho: { label: '明朝', family: '"Yu Mincho", "Hiragino Mincho ProN", serif' },
    gothic: { label: 'ゴシック', family: '"Yu Gothic", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif' },
    system: { label: 'システム', family: 'system-ui, sans-serif' }
  };
  function validate(config, sources = {}) {
    if (!config || !/^[a-zA-Z0-9_-]+$/.test(config.id || '')) throw new Error('album.config.js: id は英数字・_・-で指定してください');
    if (typeof config.title !== 'string' || !config.title.trim()) throw new Error('アルバムの title が必要です');
    if (config.ogp !== undefined) {
      if (!config.ogp || typeof config.ogp !== 'object' || Array.isArray(config.ogp)) throw new Error('OGP設定が不正です');
      for (const key of ['title','description','image','url']) if (config.ogp[key] !== undefined && typeof config.ogp[key] !== 'string') throw new Error('OGP設定は文字列で指定してください');
      if (config.ogp.url) {
        let url;try { url = new URL(config.ogp.url); } catch (_) { throw new Error('公開URLはhttps://などから始まる絶対URLで指定してください'); }
        if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('公開URLは認証情報を含まないHTTP(S)のURLで指定してください');
      }
      if (config.ogp.image && (!/\.(png|jpe?g|webp|gif|avif)$/i.test(config.ogp.image) || /[%\\\x00-\x1f?#:]/.test(config.ogp.image) || config.ogp.image.startsWith('/') || config.ogp.image.split('/').some(p=>!p || p==='.' || p==='..'))) throw new Error('OGP画像はプロジェクト内の画像パスで指定してください');
    }
    if (config.chapterUnit !== undefined && typeof config.chapterUnit !== 'string') throw new Error('シナリオの単位は文字列で指定してください');
    if (!Array.isArray(config.tracks) || !Array.isArray(config.chapters)) throw new Error('tracks と chapters は配列で指定してください');
    const files = new Set();
    for (const track of config.tracks) {
      if (!track.file || !track.title || files.has(track.file)) throw new Error('楽曲には重複しない file と title が必要です');
      files.add(track.file);
    }
    for (const chapter of config.chapters) {
      if (!chapter.title) throw new Error('章の title が必要です');
      if (chapter.desktopPosition !== undefined && !['center','top'].includes(chapter.desktopPosition)) throw new Error('PCの背景画像位置は center または top で指定してください');
      if (chapter.pages) {
        if (!Array.isArray(chapter.pages) || !chapter.pages.length || chapter.pages.some(p => typeof p.text !== 'string' || !p.text.trim())) throw new Error('pages に本文を指定してください');
        for (const page of chapter.pages) {
          if (page.backgroundColor !== undefined && !/^#[0-9a-f]{6}$/i.test(page.backgroundColor)) throw new Error('背景色は #RRGGBB で指定してください');
          if (page.transition !== undefined && !['instant','fade','crossfade','black'].includes(page.transition)) throw new Error('背景の切り替えは instant / fade / crossfade / black で指定してください');
          if (page.transitionDuration !== undefined && (!Number.isInteger(page.transitionDuration) || page.transitionDuration < 0 || page.transitionDuration > 10000)) throw new Error('切り替え時間は0〜10000ミリ秒で指定してください');
        }
      } else if (typeof sources[chapter.file] !== 'string' || !sources[chapter.file].trim()) throw new Error('シナリオがありません: ' + chapter.file);
    }
    if (config.colors && (!Array.isArray(config.colors) || config.colors.length !== 4 || config.colors.some(c => !/^#[0-9a-f]{6}$/i.test(c)))) throw new Error('colors は #RRGGBB の4色で指定してください');
    if (config.theme && !palettes[config.theme]) throw new Error('不明な theme: ' + config.theme);
    if (config.font && !fonts[config.font]) throw new Error('不明な font: ' + config.font);
    return config;
  }
  function renderHTML(html, config) {
    validate(config);
    const escape = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const ogp = config.ogp || {}, title = ogp.title || config.title, description = ogp.description || config.description || '';
    const url = ogp.url ? new URL(ogp.url).href : '';
    const image = url && (ogp.image || config.cover) ? new URL(ogp.image || config.cover, url).href : '';
    const tags = [['property','og:type','website'],['property','og:title',title],['property','og:description',description],['property','og:url',url],['property','og:image',image],['name','description',description],['name','twitter:card',image?'summary_large_image':'summary'],['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',image]];
    html = html.replace(/<title>[\s\S]*?<\/title>/i,()=>'<title>'+escape(config.title)+'</title>');
    const meta = tags.filter(([, ,value])=>value).map(([attribute,key,value])=>'<meta '+attribute+'="'+key+'" content="'+escape(value)+'">').join('\n');
    return html.replace('</head>',()=>meta+'\n</head>');
  }
  root.AlbumKit = { palettes, fonts, validate, renderHTML };
  if (typeof module !== 'undefined') module.exports = root.AlbumKit;
  if (typeof document === 'undefined' || root.ALBUM_STUDIO) return;
  const config = validate(root.ALBUM_CONFIG, root.SCENARIO_SOURCES);
  document.getElementById('album-root').innerHTML = root.ALBUM_TEMPLATE;
  const $ = id => document.getElementById(id);
  document.title = config.title;
  $('title').textContent = config.title;
  document.querySelector('.brand').textContent = config.brand || config.title;
  $('menu-brand').textContent = config.brand || config.title;
  $('album-description').textContent = config.description || '';
  $('track-count').textContent = '全' + config.tracks.length + '曲';
  const chapterUnit = config.chapterUnit?.trim() || '章';
  $('chapter-count').textContent = '全' + config.chapters.length + chapterUnit + ' ・ どの' + chapterUnit + 'からでも読めます';
  $('chapter-count').parentElement.parentElement.hidden = !config.chapters.length;
  document.querySelector('.music-panel').hidden = !config.tracks.length;
  const option = (value, text) => { const el = document.createElement('option'); el.value = value; el.textContent = text; return el; };
  config.tracks.forEach(track => $('music-track').append(option(track.file, track.title)));
  Object.entries(palettes).forEach(([key, value]) => $('theme-select').append(option(key, value.label)));
  if (config.colors) $('theme-select').append(option('custom', 'カスタム'));
  Object.entries(fonts).forEach(([key, value]) => $('font-select').append(option(key, value.label)));
  const key = config.id + '-appearance';
  let saved = {}; try { if (!root.ALBUM_PREVIEW) saved = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) {}
  $('theme-select').value = palettes[saved.theme] || (saved.theme === 'custom' && config.colors) ? saved.theme : config.colors ? 'custom' : config.theme || 'ocean';
  $('font-select').value = fonts[saved.font] ? saved.font : config.font || 'mincho';
  const compact = typeof matchMedia === 'function' ? matchMedia('(max-width: 750px), (max-width: 1100px) and (max-height: 500px)') : null;
  function apply() {
    // Compact layouts always use the author's defaults, including on rotation.
    const theme = compact?.matches ? (config.colors ? 'custom' : config.theme || 'ocean') : $('theme-select').value;
    const font = compact?.matches ? config.font || 'mincho' : $('font-select').value;
    const preset = palettes[theme] || { colors: config.colors, light: config.light };
    const [bg, panel, accent, ink] = preset.colors;
    const style = document.documentElement.style;
    for (const [name, value] of Object.entries({bg, panel, accent, ink, muted: `color-mix(in srgb, ${ink} 72%, ${bg})`, 'display-font': fonts[font].family, 'body-font': fonts.gothic.family})) style.setProperty('--' + name, value);
    style.colorScheme = preset.light ? 'light' : 'dark';
    try { if (!root.ALBUM_PREVIEW && !compact?.matches) localStorage.setItem(key, JSON.stringify({theme, font: $('font-select').value})); } catch (_) {}
  }
  if (config.cover) document.documentElement.style.setProperty('--cover-image', 'url(' + JSON.stringify(new URL(config.cover, document.baseURI).href) + ')');
  $('theme-select').addEventListener('change', apply);
  $('font-select').addEventListener('change', apply);
  compact?.addEventListener('change', apply);
  apply();
})(typeof window !== 'undefined' ? window : globalThis);
