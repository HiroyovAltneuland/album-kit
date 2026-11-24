# Album Kit

作者は音楽作品としてブックレット上のシナリオと組み合わせた作品を多数制作してきたのですが、それらを配信用に再編集しやすくするために自作したツールを一般に公開するものです。

音楽アルバムとシナリオ／ライナーノーツを、**編集・プレビュー → ビルド → アップロード**の流れで公開するツールです。

A dependency-free music album editor, story reader and static-site builder. Runs locally without an LLM or API keys. MIT licensed.

## ブラウザで試す

- [サンプルと制作室デモ](https://hiroyovaltneuland.github.io/album-kit/)
- [サンプル作品『波間のノート』](https://hiroyovaltneuland.github.io/album-kit/sample/)
- [制作室を試す](https://hiroyovaltneuland.github.io/album-kit/studio/)
- [サンプルプロジェクトZIP](https://hiroyovaltneuland.github.io/album-kit/album-kit-sample.zip)

制作室デモはGitHub Pages上で動くブラウザ体験版です。素材・編集内容はサーバーへ送信せず、このタブ内で処理します。「制作一式を保存」で編集再開用ZIP、「公開用ZIP」で閲覧用の静的ファイルをダウンロードできます。タブを閉じる前に保存してください。ダウンロードした制作一式は、以下のローカル制作室で引き続き編集できます。原稿のコンパイルはローカル版で行います。

サンプルの本文・画像・合成音源はオリジナルで、ツールと同じMITライセンスです。サンプル画像と音源は `demo/sample.cjs` から生成し、実作品のコンテンツは含めません。

デモの配信元はこのリポジトリのGitHub Pagesです。管理者は Settings → Pages → Source を **GitHub Actions** に設定してください。`main` への更新時にテスト・サンプル生成・公開が実行されます。ローカル確認用の生成コマンドは `node build-demo.cjs`、出力は `_site/` です。

## はじめる

[Node.js](https://nodejs.org/) 22以上をインストールし、このリポジトリをダウンロードまたはcloneしてください。npmパッケージのインストールは不要です。

1. Windowsでは `create-album.bat`、Macでは `create-album.command` を開き、新作フォルダ名を入力
2. 作成された `releases/作品名/` 内の `album-kit/open-studio.bat` または `.command` を開く
3. ブラウザの制作室で音源・画像・本文を入力して保存
4. 「公開用にビルド」で生成されたフォルダの中身を静的ホスティングへアップロード

`releases/` はツールフォルダの1つ上に作成します。既存の作品は上書きしません。制作中は起動したコンソールを開いたままにしてください。

Macで `.command` の実行権限がない場合は `bash ` に続けてファイルをターミナルへドラッグし、Enterで実行できます。Gitから取得した `.command` には実行権限を付けています。

コマンドでも作成できます。このリポジトリのルートから実行します。

```sh
node create.cjs ../my-album
node ../my-album/album-kit/studio.cjs
```

完成したアルバムは `index.html` を開くだけで閲覧できます。閲覧者にはNode.jsは不要です。

## 主な機能

- 楽曲の試聴、シーク、リピート、曲順編集
- 章・ページ・話者・BGM・画像の編集とプレビュー
- 章単位の折り畳み
- 配色プリセット、独自カラー、OS内蔵フォントの切り替え
- スマホ縦持ち・横持ちプレビュー
- 章／ページ別の正方形画像トリミング、ドラッグ枠と0.1％スライダー
- 使用中の素材だけを含む静的サイトのビルド

詳しい操作は [制作手順](WORKFLOW.md) を参照してください。制作データは `album.project.json`、素材は `image/`・`mp3/`、出力は `dist/` に保存します。素材の取り込みはローカルコピーで、外部サービスへの送信は行いません。

ブラウザ体験版の保存は、利用者だけの新しいZIPをダウンロードする操作です。公開中のサンプルや他の利用者のデータは変更しません。[セキュリティの範囲と注意点](SECURITY.md) も参照してください。第三者から受け取ったプロジェクトのJavaScriptや起動スクリプトは、信頼できるものだけをローカルで実行してください。

## ファイル構成

- `studio.*`: 制作室UIとローカルHTTPサーバー
- `crop-editor.js`: グラフィカルな画像位置調整
- `project.cjs`: 制作データの読み書き、素材検証、静的ビルド
- `player.js` / `setup.js` / `template.js` / `base.css`: 公開用プレイヤー
- `create.cjs` / `starter.html`: 新規作品のひな形

1ページ1プレイヤーに対応します。音楽の自動再生はブラウザの制約に従います。Mac実機・iOS Safari・Android実機の確認は今後の検証事項です。

## 開発・テスト

```sh
npm test
```

依存パッケージはありません。テストは一時フォルダのサンプルを使い、画像・音源・原稿をリポジトリに用意する必要はありません。

## コンテンツの扱い

このリポジトリにはシステムだけを収録します。音源・画像・原稿・作品設定・ビルド成果物は `.gitignore` で除外しています。新しい拡張子の素材や別形式で原稿を追加した場合は、Gitへ登録する前に除外設定を確認してください。

## ライセンス

システムと独自ドキュメントは [MIT](LICENSE)。生成した公開用サイトにもライセンス文を同梱します。作品の音源・画像・原稿等にMITが自動適用されることはありません。出典は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にまとめています。

`.ks` 原稿の配置、TyranoScript風の記法、対応タグと取り込み方法は [制作手順の .ks 原稿](WORKFLOW.md#ks-原稿を使う場合) を参照してください。
