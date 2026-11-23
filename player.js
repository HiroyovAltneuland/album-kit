/* The source parser is also exported for dependency-free validation in Node. */
(function (root) {
  function parseScenario(source, speakerNames = []) {
    const tagged = /^#/m.test(source);
    const names = new Set(speakerNames);
    let speaker = '', buffer = '', bgm = null, image = null;
    const pages = [];
    function flush() {
      if (buffer.trim()) pages.push({ speaker, text: buffer.trim(), bgm, image });
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
          if (/^\[image\b/.test(part)) image = storage;
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
      if (next) audio.src = (config.audioBase || '') + encodeURIComponent(next);
      else { audio.removeAttribute('src'); audio.load(); }
      updateSeek();
    }
    if (track && enabled) audio.play().catch(() => { $('music-status').textContent = '再生できませんでした。音源を確認して再生を押してください。'; });
  }
  function render() {
    const chapter = chapters[current], item = chapter.pages[page];
    const background = item.image ? (config.imageBase || '') + item.image : chapterImage(current);
    // CSS is served from album-kit/: resolve images against the HTML, not the stylesheet.
    $('game').style.setProperty('--scene-image', background ? `url(${JSON.stringify(new URL(background, document.baseURI).href)})` : 'none');
    $('game').style.setProperty('--portrait-focus', item.portraitPosition || chapter.portraitPosition || chapter.crop || 'center');
    $('reading-area').hidden = !background;
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
  function start(index) {
    current = index; page = 0;
    $('menu').hidden = true; $('reader').hidden = false; $('menu-button').hidden = false;
    $('game').classList.add('playing'); render(); $('next').focus();
  }
  function menu() {
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
  const previewLocation = typeof location !== 'undefined' && root.ALBUM_PREVIEW ? new URLSearchParams(location.hash.slice(1)) : null;
  if (previewLocation && previewLocation.has('chapter')) {
    const index = Number(previewLocation.get('chapter')), requestedPage = Number(previewLocation.get('page'));
    if (Number.isInteger(index) && chapters[index]) { start(index); page = Math.max(0, Math.min(chapters[index].pages.length - 1, Number.isInteger(requestedPage) ? requestedPage : 0)); render(); }
  }
  document.addEventListener('keydown', event => {
    if (current < 0 || $('next-dialog').open || /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.code === 'ArrowLeft' && page > 0) { page--; render(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
