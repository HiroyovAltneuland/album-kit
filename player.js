/* The source parser is also exported for dependency-free validation in Node. */
(function (root) {
  function parseScenario(source, speakerNames = []) {
    const tagged = /^#/m.test(source);
    const names = new Set(speakerNames);
    let speaker = '', buffer = '', bgm = null, image = null, backgroundColor, transition, transitionDuration;
    const pages = [];
    function flush() {
      if (buffer.trim()) {
        pages.push({ speaker, text: buffer.trim(), bgm, image,
          ...(backgroundColor ? {backgroundColor} : {}),
          ...(transition ? {transition,transitionDuration} : {}) });
        transition = undefined; transitionDuration = undefined;
      }
      buffer = '';
    }
    for (const raw of source.replace(/\r/g, '').split('\n')) {
      const line = raw.trim();
      if (!line || /^[;*]/.test(line)) continue;
      if (line.startsWith('#') || (!tagged && names.has(line))) {
        flush(); speaker = line.startsWith('#') ? line.slice(1).trim() : line; continue;
      }
      const parts = line.split(/(\[[^\]]*\])/g).filter(Boolean);
      for (const part of parts) {
        if (part === '[p]') { flush(); continue; }
        if (part.startsWith('[')) {
          flush();
          const storage = /storage="([^"]+)"/.exec(part)?.[1];
          if (/^\[playbgm\b/.test(part)) bgm = storage;
          if (/^\[stopbgm\b/.test(part)) bgm = null;
          if (/^\[(image|bg)\b/.test(part)) {
            const color = /color="([^"]+)"/.exec(part)?.[1];
            if (color !== undefined) {
              backgroundColor = color === 'black' ? '#000000' : color === 'white' ? '#ffffff' : color;
              image = null;
            } else { image = storage || null; backgroundColor = undefined; }
            transition = /effect="([^"]+)"/.exec(part)?.[1] || 'instant';
            const time = /time="([^"]+)"/.exec(part)?.[1];
            transitionDuration = time === undefined ? 800 : Number(time);
          }
        } else buffer += part;
      }
      if (tagged) { if (buffer) buffer += '\n'; }
      else { flush(); speaker = ''; }
    }
    flush();
    return pages;
  }
  if (typeof module !== 'undefined') module.exports = { parseScenario };
  if (typeof document === 'undefined') return;
  if (!root.ALBUM_CONFIG) throw new Error('album.config.js を読み込んでください');
  const $ = id => document.getElementById(id);
  const sources = root.SCENARIO_SOURCES || {};
  const config = root.ALBUM_CONFIG;
  const toolbarToggle = $('toolbar-toggle'), toolbarTools = $('toolbar-tools');
  function closeToolbar() {
    toolbarToggle.setAttribute('aria-expanded', 'false');
    toolbarTools.classList.remove('is-open');
  }
  toolbarToggle.addEventListener('click', () => {
    const open = toolbarToggle.getAttribute('aria-expanded') !== 'true';
    toolbarToggle.setAttribute('aria-expanded', String(open));
    toolbarTools.classList.toggle('is-open', open);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.toolbar')) closeToolbar();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toolbarToggle.getAttribute('aria-expanded') === 'true') {
      closeToolbar(); toolbarToggle.focus();
    }
  });
  const chapters = config.chapters.map(chapter => ({ ...chapter, pages: chapter.pages || parseScenario(sources[chapter.file] || '', config.speakers) }));
  for (const chapter of chapters) { if (!chapter.pages.length) throw new Error('本文がありません: ' + chapter.title); }
  const storageKey = config.id + '-read';
  let current = -1, page = 0, enabled = true, track = null;
  let completed = [];
  try { completed = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(completed)) completed = []; } catch (_) {}
  const audio = new Audio(); audio.loop = false; audio.volume = .4;
  audio.addEventListener('error', () => { $('music-status').textContent = '音源を読み込めませんでした。ファイルを確認してください。'; });
  let loopMusic = false;
  function formatTime(seconds) {
    const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  }
  function updateSeek() {
    const duration = track && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const position = duration ? Math.min(Math.max(audio.currentTime || 0, 0), duration) : 0;
    $('music-seek').disabled = !duration;
    $('music-seek').max = String(duration);
    $('music-seek').value = String(position);
    $('music-seek').setAttribute('aria-valuetext', formatTime(position) + ' / ' + formatTime(duration));
    $('music-elapsed').textContent = formatTime(position);
    $('music-duration').textContent = formatTime(duration);
  }
  for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'emptied']) audio.addEventListener(event, updateSeek);
  $('music-seek').addEventListener('input', event => {
    if (!track || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const position = Number(event.target.value);
    if (!Number.isFinite(position)) return;
    audio.currentTime = Math.min(Math.max(position, 0), audio.duration);
    updateSeek();
  });
  const musicFiles = config.tracks.map(track => track.file);
  function musicStatus() {
    $('music-status').textContent = '再生中：' + (config.tracks.find(item => item.file === track)?.title || track);
  }
  $('music-mode').addEventListener('click', () => {
    loopMusic = !loopMusic;
    $('music-mode').setAttribute('aria-pressed', String(loopMusic));
    $('music-mode').title = loopMusic ? 'リピートをオフにする（現在はこの曲を繰り返す）' : 'リピートをオンにする（現在は次の曲へ）';
    $('music-mode-status').textContent = loopMusic ? 'この曲を繰り返す' : '曲が終わったら次の曲へ';
    if (current < 0) audio.loop = loopMusic;
  });
  audio.addEventListener('ended', () => {
    if (current >= 0 || !track || loopMusic || !musicFiles.length) return;
    const index = musicFiles.indexOf(track);
    const following = musicFiles[(index + 1) % musicFiles.length];
    $('music-track').value = following;
    playTrack(following); musicStatus();
  });
  function updateSoundButton() {
    $('sound').textContent = enabled ? 'BGM ON' : 'BGM OFF';
    $('sound').setAttribute('aria-pressed', String(enabled));
  }
  $('music-play').addEventListener('click', () => {
    const selected = $('music-track').value || musicFiles[0];
    if (!musicFiles.includes(selected)) return;
    enabled = true; updateSoundButton(); playTrack(selected);
    musicStatus();
  });
  $('music-stop').addEventListener('click', () => {
    audio.pause(); $('music-status').textContent = '一時停止中';
  });
  $('music-track').addEventListener('change', () => {
    playTrack(null); $('music-status').textContent = '「▶」で選択した曲を再生します';
  });
  function chapterImage(index) { return chapters[index].image || config.cover || ''; }
  chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.className = 'chapter';
    button.style.setProperty('--crop', chapter.crop || '50%');
    button.style.setProperty('--tone', chapter.tone || 'none');
    const thumb = document.createElement('div'); thumb.className = 'thumbnail';
    const img = document.createElement('img'); if (chapterImage(index)) img.src = chapterImage(index); else thumb.hidden = true; img.alt = ''; thumb.append(img);
    const info = document.createElement('div'); info.className = 'chapter-info';
    const act = document.createElement('span'); act.className = 'act'; act.textContent = chapter.act;
    const title = document.createElement('h3'); title.textContent = chapter.title;
    const mark = document.createElement('span'); mark.className = 'read-mark'; mark.textContent = completed.includes(index) ? '読了' : '読む';
    info.append(act, title, mark); button.append(thumb, info);
    button.addEventListener('click', () => start(index)); $('chapters').append(button);
  });
  function playTrack(next) {
    audio.loop = current >= 0 || loopMusic;
    if (next !== track) {
      audio.pause(); track = next;
      if (next) audio.src = root.ALBUM_PREVIEW && /^(blob:|https?:)/.test(next) ? next : (config.audioBase || '') + encodeURIComponent(next);
      else { audio.removeAttribute('src'); audio.load(); }
      updateSeek();
    }
    if (track && enabled) audio.play().catch(() => { $('music-status').textContent = '再生できませんでした。音源を確認して再生を押してください。'; });
  }
  let sceneKey = null, finishScene = () => {};
  function changeScene(key, apply, effect, duration) {
    finishScene();
    if (key === sceneKey) { apply(); return; }
    const entering = sceneKey === null;
    const animate = effect !== 'instant' && duration > 0 &&
      typeof getComputedStyle === 'function' && typeof document.createElement('div').animate === 'function' &&
      !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    sceneKey = key;
    if (!animate) { apply(); return; }
    const layers = [];
    const surfaces = [document.querySelector('.backdrop'), $('reading-area')];
    for (const surface of surfaces) {
      const computed = getComputedStyle(surface);
      const layer = document.createElement('div');
      layer.className = surface === surfaces[0] ? 'scene-transition-backdrop' : 'scene-transition-portrait';
      layer.setAttribute('aria-hidden','true');
      Object.assign(layer.style, {position:'absolute',inset:'0',pointerEvents:'none',
        background:entering || effect === 'black' ? '#000' : computed.background,
        borderRadius:computed.borderRadius});
      if (surface === surfaces[0]) {
        Object.assign(layer.style,{top:computed.top,zIndex:'-1',
          filter:entering || effect === 'black' ? 'none' : computed.filter,transform:computed.transform});
        $('game').append(layer);
      } else { layer.style.zIndex='1';surface.append(layer); }
      layers.push(layer);
    }
    let animations = [], finished = false;
    const clean = () => { animations.forEach(a=>a.cancel());layers.forEach(layer=>layer.remove()); };
    finishScene = () => { if(finished)return;finished=true;apply();clean(); };
    const run = (from,to,time) => {
      animations=layers.map(layer=>layer.animate([{opacity:from},{opacity:to}],{duration:time,fill:'forwards',easing:'ease-in-out'}));
      return Promise.all(animations.map(a=>a.finished));
    };
    if(effect === 'black' && !entering) {
      run(0,1,duration/2).then(()=>{if(finished)return;apply();return run(1,0,duration/2);}).then(()=>{if(!finished)finishScene();}).catch(()=>{});
    } else {
      apply();run(1,0,duration).then(()=>{if(!finished)finishScene();}).catch(()=>{});
    }
  }
  function render() {
    const chapter = chapters[current], item = chapter.pages[page];
    const background = item.image ? (config.imageBase || '') + item.image : chapterImage(current);
    // CSS is served from album-kit/: resolve images against the HTML, not the stylesheet.
    const color = item.backgroundColor || '';
    const apply = () => {
    $('game').style.setProperty('--scene-image', color ? 'none' : background ? `url(${JSON.stringify(new URL(background, document.baseURI).href)})` : 'none');
    $('game').style.setProperty('--scene-color', color || 'transparent');
    $('game').classList.toggle('solid-scene', Boolean(color));
    $('game').style.setProperty('--desktop-scene-position', chapter.desktopPosition === 'top' ? 'center top' : 'center center');
    $('game').style.setProperty('--portrait-focus', item.portraitPosition || chapter.portraitPosition || chapter.crop || 'center');
    $('reading-area').hidden = !color && !background;
    };
    changeScene(JSON.stringify([current,color || background,item.portraitPosition || chapter.portraitPosition,chapter.desktopPosition]),apply,item.transition || 'instant',item.transitionDuration ?? 800);
    $('chapter-title').textContent = chapter.act + '：' + chapter.title;
    $('page-count').textContent = `${page + 1} / ${chapter.pages.length}`;
    $('speaker').textContent = item.speaker;
    $('speaker').hidden = !item.speaker;
    $('message').textContent = item.text;
    $('previous').disabled = page === 0;
    $('progress-fill').style.width = ((page + 1) / chapter.pages.length * 100) + '%';
    $('end-hint').textContent = page === chapter.pages.length - 1 ? (current === chapters.length - 1 ? 'クリックでメニューへ' : 'クリックで読了') : '';
    playTrack(item.bgm);
  }
  function start(index, requestedPage = 0) {
    closeToolbar();
    finishScene(); sceneKey = null;
    // Chapter entry is a musical cue, even when the previous track is identical.
    playTrack(null);
    current = index; page = Math.max(0, Math.min(chapters[index].pages.length - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
    $('menu').hidden = true; $('reader').hidden = false; $('menu-button').hidden = false;
    $('game').classList.add('playing'); render(); $('next').focus();
  }
  function menu() {
    closeToolbar();
    finishScene(); sceneKey = null;
    current = -1; playTrack(null);
    $('music-status').textContent = '';
    $('menu').hidden = false; $('reader').hidden = true; $('menu-button').hidden = true;
    $('game').classList.remove('playing');
    $('chapters').querySelectorAll('.read-mark').forEach((mark, index) => mark.textContent = completed.includes(index) ? '読了' : '読む');
  }
  function next() {
    if (current < 0 || $('next-dialog').open) return;
    if (page < chapters[current].pages.length - 1) { page++; render(); return; }
    if (!completed.includes(current)) completed.push(current);
    try { localStorage.setItem(storageKey, JSON.stringify(completed)); } catch (_) {}
    if (current === chapters.length - 1) { menu(); $('chapters').children[current < 0 ? chapters.length - 1 : current].focus(); return; }
    const following = chapters[current + 1];
    $('next-title').textContent = following.act + '：' + following.title;
    $('next-dialog').showModal(); $('yes').focus();
  }
  $('next').addEventListener('click', next);
  $('message').addEventListener('click', next);
  $('reading-area').addEventListener('click', next);
  $('previous').addEventListener('click', () => { if (page > 0) { page--; render(); } });
  $('menu-button').addEventListener('click', menu);
  $('yes').addEventListener('click', () => { $('next-dialog').close(); start(current + 1); });
  $('no').addEventListener('click', () => { $('next-dialog').close(); menu(); });
  $('next-dialog').addEventListener('cancel', event => { event.preventDefault(); $('next-dialog').close(); menu(); });
  $('sound').addEventListener('click', () => {
    enabled = !enabled; updateSoundButton();
    if (current < 0 && track) $('music-status').textContent = enabled ? '再生中' : 'BGM OFF：再生を一時停止しています';
    if (!enabled) audio.pause(); else playTrack(track);
  });
  $('volume').addEventListener('input', event => { audio.volume = Number(event.target.value) / 100; });
  // Studio can open the exact page being edited without changing the published UI.
  const previewLocation = root.ALBUM_PREVIEW_LOCATION ? new URLSearchParams(root.ALBUM_PREVIEW_LOCATION) : typeof location !== 'undefined' && root.ALBUM_PREVIEW ? new URLSearchParams(location.hash.slice(1)) : null;
  if (previewLocation && previewLocation.has('chapter')) {
    const index = Number(previewLocation.get('chapter')), requestedPage = Number(previewLocation.get('page'));
    if (Number.isInteger(index) && chapters[index]) start(index, requestedPage);
  }
  document.addEventListener('keydown', event => {
    if (current < 0 || $('next-dialog').open || /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.code === 'ArrowLeft' && page > 0) { page--; render(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
