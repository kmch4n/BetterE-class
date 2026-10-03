# BetterE-class

同志社大学の e-class（WebClass）を使いやすくする、非公式の Chrome 拡張機能です。
締切の確認、教材の保存、動画の視聴、クイズの書き出しといった日々の操作を、e-class の画面になじむ形で補います。

[Chrome ウェブストア](https://chromewebstore.google.com/detail/cadnlcomccllmcigggjcceocibeicpbj) ・ [機能の詳細](docs/BetterE-class.md) ・ [リリース](https://github.com/kmch4n/BetterE-class/releases)

> 同志社大学および e-class の運営とは関係のない、個人による開発です。

## 主な機能

画面写真の科目名・氏名は架空のものに置き換えています。

### 締切とよく使う科目

<img src="docs/images/top-sidebar.png" width="220" alt="トップページ左の「締切が近い課題」と「ピン留め科目」">

科目一覧の左側に、締切が近い課題を一覧で表示します。未提出の課題名と、締切までの残り時間・締切日時がわかり、残り24時間を切ると赤字になります。よく使う科目はピン留めしておくと、すぐ下に並びます。

<img src="docs/images/deadline-chip.png" width="560" alt="科目一覧の「締切が近い課題があります。」の札">

e-class が出す「締切が近い課題があります。」の表示も、時計の印が付いた札として見つけやすくします。

### コースページの目次

<img src="docs/images/course-toc.png" width="600" alt="コースページ左の目次">

コースページの左の列に、回ごとの目次を表示します。読んでいる回とその前後が開き、スクロールに合わせて切り替わります。新しい教材には「New」、利用できない教材には鍵の印が付きます。

### 教材の保存と動画

<img src="docs/images/textbook-panel.png" width="300" alt="教材ページの操作パネル">

教材ページの目次の上に、選んでいる節の資料を保存・プレビューするパネルを置きます。配信形式の動画も MP4 に変換して保存でき、節ごとに分かれた動画を1本につなげて保存することもできます。変換はすべてブラウザの中で行います。

- 動画が終わると次の節へ進んで再生を続けられます（設定でオン）
- ミュートにした状態は次の動画にも引き継がれます。常にミュートで始める設定もあります
- 添付ファイルやレポートは、別ウインドウではなく新しいタブで開きます

### クイズと課題

<img src="docs/images/quiz-copy.png" width="400" alt="問題文の上の「問題をコピー」ボタン">

表示している問題を、問題文と選択肢ごとクリップボードにコピーできます。問題文は画面どおりの改行で取り出します。

<img src="docs/images/quiz-export.png" width="160" alt="左の列の「全てコピー」「全て出力」">

「全てコピー」「全て出力」を使うと、すべての問題を順に表示して集め、まとめてコピーするかテキストファイルに保存します。

### メッセージ

<img src="docs/images/message-toolbar.png" width="343" alt="受信箱のツールバーに加わった「すべて既読にする」">

受信箱に「すべて既読にする」を加え、表示中のページのメッセージをまとめて既読にできます。

### 設定

<img src="docs/images/popup.png" width="420" alt="拡張機能の設定画面">

ツールバーのアイコンから設定を開きます。機能はカテゴリごとに分かれていて、検索欄から探すこともできます。切り替えた設定はその場で保存されます。

ほかに、時間割表の土曜日や6・7限を隠す設定、トップページの各欄の折りたたみ、ダークモード（ベータ版）があります。すべての機能は [docs/BetterE-class.md](docs/BetterE-class.md) にまとめています。

## インストール

[Chrome ウェブストア](https://chromewebstore.google.com/detail/cadnlcomccllmcigggjcceocibeicpbj)から追加してください。更新は自動で届きます。

手元のソースから使う場合は、このリポジトリを取得し、`chrome://extensions/` でデベロッパーモードをオンにして `extension` フォルダを読み込みます。

## データの扱い

- 処理はすべてブラウザの中で行い、e-class（`eclass.doshisha.ac.jp`）以外とは通信しません
- 設定やピン留めした科目は、ブラウザの拡張機能用ストレージ（`chrome.storage.local`）に保存します
- 締切の詳細は、e-class 自身の「課題実施状況一覧」と同じデータをログイン中のセッションで読み取っています

使用する権限は次のとおりです。

| 権限 | 用途 |
|---|---|
| `storage` | 設定とピン留めの保存 |
| `downloads` | 教材・添付ファイル・動画の保存 |
| `tabs` | 設定を変えたときに、開いている e-class のタブへ反映する |
| `declarativeNetRequest` | ファイルをダウンロードではなくブラウザ内で表示する |
| `clipboardWrite` | クイズの問題のコピー |

## 開発

ビルドは不要で、`extension` フォルダがそのまま拡張機能になります。テストは Node.js の標準機能で動きます。

```bash
node --test tests/*.test.js
```

構成や実装の詳細は [docs/TechNote.md](docs/TechNote.md) を参照してください。不具合や要望は [Issues](https://github.com/kmch4n/BetterE-class/issues) へどうぞ。

## 注意事項

e-class の画面構成が変わると、予告なく動かなくなることがあります。利用は各自の判断でお願いします。本拡張機能の利用によって生じた損害について、作者は責任を負いません。

## ライセンス

[MIT License](LICENSE)
