# BetterE-class への貢献

BetterE-class に興味を持っていただきありがとうございます。不具合の報告、要望、コードやドキュメントの修正など、どんな形の参加も歓迎します。

## はじめる前に

- e-class（`eclass.doshisha.ac.jp`）は同志社大学のアカウントでしか利用できません。動作確認には、ログインできる環境が必要です
- e-class の運営とは関係のない、非公式のプロジェクトです。e-class 側への問い合わせはしないでください
- 脆弱性を見つけた場合は、Issue ではなく [SECURITY.md](SECURITY.md) の手順で報告してください

> [!CAUTION]
> e-class の画面には氏名、学生番号、履修科目などの個人情報が含まれます。Issue や Pull Request にスクリーンショットや HTML を載せるときは、必ず該当箇所を塗りつぶすか、架空の内容に置き換えてください。

## 不具合の報告と要望

[Issues](https://github.com/kmch4n/BetterE-class/issues/new/choose) からテンプレートを選んで投稿してください。

- 投稿する前に、同じ内容の Issue がないか検索してください
- 不具合は、起きたページの URL（クエリは省いてかまいません）、手順、バージョンがわかると調べやすくなります
- 大きな機能を追加したい場合は、実装を始める前に Issue で相談してください

## 開発の流れ

### 環境

ビルドや依存パッケージのインストールは不要です。用意するのは次の2つだけです。

- Google Chrome
- Node.js 20 以上（テストと構文チェックに使います）

### 手元で動かす

1. リポジトリをフォークしてクローンする
2. `chrome://extensions/` でデベロッパー モードをオンにし、「パッケージ化されていない拡張機能を読み込む」から `extension` フォルダを選ぶ
3. ファイルを変更したら、`chrome://extensions/` の再読み込みボタン（↻）を押し、e-class のページも再読み込みする

コンテンツスクリプトのログは e-class のページの DevTools に、バックグラウンドのログは `chrome://extensions/` の「Service Worker」から開く DevTools に出ます。設定画面の「デバッグモード」をオンにすると、詳しいログが出ます。

### 構成

| パス | 内容 |
|---|---|
| `extension/` | 配布する拡張機能の本体。`manifest.json` が注入するスクリプトや権限の正本 |
| `extension/utils/` | 共通の処理。`window.BetterEclassUtils` から使う |
| `extension/background.js` | ダウンロードやタブ操作を担う Service Worker |
| `tests/` | Node.js 標準のテストランナーで動くテスト |
| `docs/` | 機能の説明（[BetterE-class.md](docs/BetterE-class.md)）と技術ノート（[TechNote.md](docs/TechNote.md)） |

実装の詳細は [docs/TechNote.md](docs/TechNote.md) を参照してください。

### コーディングの決まり

- コンテンツスクリプトは素の JavaScript で書き、IIFE で囲んでほかのスクリプトと干渉しないようにする
- コード中の識別子とコメントは英語、利用者に見える文言とドキュメントは日本語にする
- インデントは 4 スペース。Prettier を使う場合は `--tab-width 4` を指定する
- e-class の HTML は予告なく変わるため、セレクタは狭く指定し、要素が見つからないときも壊れないようにする
- 画面に追加する要素は、初期化が何度走っても重複しないようにする
- スクリプトを追加・削除・並べ替えたときは `extension/manifest.json` も更新する
- ファイル拡張子の許可リストは `extension/background.js` と `extension/content.js` の両方をそろえる

> [!IMPORTANT]
> 外部へのデータ送信、ホスト権限の拡大、新しい Chrome の権限の追加は、利用者のプライバシーに関わるため、事前に Issue で相談してください。

### 確認

Pull Request を出す前に、次を実行してください。

```bash
# テスト
node --test tests/*.test.js

# 変更した JavaScript の構文チェック
node --check extension/path/to/changed-file.js
```

あわせて、変更が関係する e-class のページで実際に動かして確かめてください。設定のオン・オフや、教材・クイズのようにフレームの中で動くページも確認対象です。

## Pull Request

1. `main` から作業用のブランチを切る（例: `fix/deadline-chip`、`feat/quiz-export`）
2. 変更は1つの目的にしぼる。関係のない整形や修正は別の Pull Request に分ける
3. テンプレートに沿って、変更内容と確認した内容を書く
4. 見た目が変わる場合は、変更前と変更後のスクリーンショットを付ける（個人情報は隠す）

コミットメッセージは英語の現在形で、`[gitmoji] メッセージ` の形式にそろえています（例: `[🐛] Fix deadline chip on the course list`）。絵文字の意味は [gitmoji.dev](https://gitmoji.dev/) を参照してください。形式が違っていても、マージするときにメンテナーが整えるので気にしなくてかまいません。

## リリース

リリースはメンテナーが行います。手順とリリースノートの書き方は [docs/RELEASING.md](docs/RELEASING.md) にまとめています。
