const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');

function create(target) {
  const destination = path.resolve(target);
  const relative = path.relative(__dirname, destination);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('ライブラリの外に作成してください');
  if (fs.existsSync(destination)) throw new Error('既存のフォルダは上書きしません: ' + destination);
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(__dirname, path.join(destination, 'album-kit'), { recursive: true, filter: source => {
    const relative = path.relative(__dirname, source);
    return !relative.split(path.sep).some(part => ['.git','.github','_site','node_modules','.idea','.vscode','UI-REVIEW.md'].includes(part) || part.startsWith('.env') || /\.(pem|key)$/i.test(part));
  } });
  fs.mkdirSync(path.join(destination, 'mp3'));
  fs.mkdirSync(path.join(destination, 'image'));
  fs.mkdirSync(path.join(destination, 'script'));
  fs.copyFileSync(path.join(__dirname, 'starter.html'), path.join(destination, 'index.html'));
  const config = {id: 'album-' + require('node:crypto').randomUUID(), title:'New Album', brand:'Artist / New Album', description:'ここにアルバムの紹介を書きます。', theme:'ocean', font:'mincho', audioBase:'mp3/', imageBase:'image/', speakers:[], tracks:[], chapters:[{act:'01',title:'ライナーノーツ',pages:[{speaker:'',text:'ここに本文を書きます。',bgm:null}]}]};
  fs.writeFileSync(path.join(destination, 'album.config.js'), 'window.ALBUM_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');
  // Preserve executable permission when the generator runs on macOS/Linux.
  if (process.platform !== 'win32') for (const name of ['create-album.command','open-studio.command']) fs.chmodSync(path.join(destination, 'album-kit', name), 0o755);
  console.log('Created: ' + destination + '\nOpen album-kit/open-studio.bat (Windows) or open-studio.command (Mac) to edit and build.');
}

async function main() {
  const target = process.argv[2];
  if (target === '--interactive') {
    const prompt = readline.createInterface({input: process.stdin, output: process.stdout});
    try {
      console.log('Album Kit / 新しいアルバムを作成\n保存先: ' + path.resolve(__dirname, '..', 'releases'));
      const name = (await prompt.question('フォルダ名 / Folder name (Enter = cancel): ')).trim();
      if (!name) { console.log('Cancelled.'); return; }
      if (/[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Windows / Mac 共通で使えるフォルダ名を指定してください');
      create(path.resolve(__dirname, '..', 'releases', name));
    } finally { prompt.close(); }
  } else {
    if (!target) throw new Error('Usage: node album-kit/create.cjs <new-folder>');
    create(target);
  }
}
main().catch(error => { console.error('\nError: ' + error.message); process.exitCode = 1; });
