# BetterE-class 技術ノート

BetterE-classの各ファイルの役割と実装の技術的な詳細を説明します。

## 全体構成

### 技術スタック
- Chrome Manifest V3拡張機能
- JavaScript (ES6+)
- Chrome Extension APIs (storage, tabs, downloads, runtime)
- declarativeNetRequest API
- Content Scripts

### アーキテクチャパターン
- IIFE (即時実行関数式)
- Namespace パターン
- Message Passing (background ⇔ content scripts)

---

## manifest.json

拡張機能の設定ファイル。

### 重要な設定

**host_permissions**
```json
"host_permissions": ["*://eclass.doshisha.ac.jp/*"]
```
末尾の `/*` が重要。これがないとDNRルールとbackground.jsからのアクセスが正しく動作しない。

**permissions**
- `declarativeNetRequest` - HTTPヘッダー操作
- `storage` - 設定の保存
- `tabs` - タブ操作
- `downloads` - ファイルダウンロード

**content_scripts**
各ページに注入するスクリプトを定義。`run_at`で実行タイミングを制御：
- `document_start` - DOM構築開始直後
- `document_end` - DOM構築完了後
- `document_idle` - ページ読み込み完了後

---

## background.js

バックグラウンドサービスワーカー。

### 主な機能

**1. ファイルダウンロード (`downloadFile`)**
- `chrome.downloads.download()` を使用
- コンテンツスクリプトからのメッセージを受け取り処理

**2. 実ファイルURL抽出 (`extractRealFileUrl`)**
- `file_down.php` や `loadit.php` から実際のファイルURLを抽出
- HTML内のJavaScriptコードを解析
- 正規表現でパラメータをパース

**3. プレビュータブ作成 (`createPreviewTab`)**
- URLに `_preview=1` パラメータを付加
- 新しいタブで開く

### 使用技術
- Service Worker API
- chrome.downloads API
- chrome.runtime.onMessage
- fetch API

---

## rules.json

declarativeNetRequestのルール定義。

### 目的
`_preview=1` パラメータを含むURLから `Content-Disposition: attachment` ヘッダーを削除。これによりファイルがダウンロードされずにブラウザで表示される。

### ルール構造
```json
{
  "id": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      {"header": "Content-Disposition", "operation": "remove"}
    ]
  },
  "condition": {
    "urlFilter": "*://eclass.doshisha.ac.jp/webclass/file_down.php?*_preview=1*"
  }
}
```

---

## ユーティリティモジュール

### utils/settings.js

設定管理API。

**提供API**
```javascript
window.BetterEclassUtils.settings = {
  getSettings: async (keys) => {...},
  setSettings: async (settings) => {...},
  migrateFromSync: async () => {...}
}
```

**デフォルト値**
- `enableDarkMode: false`
- `hideSaturday: false`
- `hide67thPeriod: false`
- `enableTocSidebar: true`
- `enableAvailableMaterials: true`

**使用技術**
- chrome.storage.local API
- Promise / async-await

---

### utils/material-icons.js

Google Material Symbolsアイコンを生成。

**アイコンマッピング**
- `document` → `description` (資料)
- `test` → `quiz` (テスト)
- `report` → `assignment` (レポート)
- `survey` → `poll` (アンケート)
- `default` → `article`

---

### utils/button-factory.js

統一されたボタンを生成。

```javascript
window.BetterEclassUtils.buttonFactory = {
  createButton: (text, className, onClick) => {...}
}
```

---

## コンテンツスクリプト

### グローバル (全e-classページ)

#### message-interceptor.js
**実行**: `document_start`、`all_frames: true`

ポップアップウィンドウを防止し、新しいタブで開く。

**実装方法**
1. イベントキャプチャリングでクリックを捕捉
2. 特定URLパターンをチェック
3. `preventDefault()` でデフォルト動作を停止
4. `chrome.runtime.sendMessage()` で新しいタブを開く
5. `window.open()` をオーバーライド

---

#### deadline-highlight.js
**実行**: `document_start`

締切が近い課題を赤色で強調表示。

**実装方法**
1. `<style>` タグを動的に挿入
2. DOM内の日時テキストをパース
3. 現在時刻との差を計算
4. 指定時間以内なら `.deadline-warning` クラスを付与
5. MutationObserverで動的追加に対応

---

#### dark-mode.js
**実行**: `document_start`

ダークモードテーマを適用。

**実装方法**
1. 設定から `enableDarkMode` を取得
2. ダークテーマのCSSを `<style>` タグで挿入
3. `body` に `.dark-mode` クラスを追加
4. ポップアップからの設定変更を監視
5. リアルタイムで切り替え

**CSS例**
```css
body.dark-mode {
  background-color: #1e1e1e !important;
  color: #e0e0e0 !important;
}
```

---

#### footer-branding.js
**実行**: `document_end`

ページ下部にバージョン情報を表示。

**実装方法**
1. `chrome.runtime.getManifest()` でバージョン取得
2. `<div>` 要素を作成
3. GitHubリポジトリへのリンクを設定
4. `document.body.appendChild()` で追加

---

### コースページ

#### eclass-top-button.js
**対象**: `*/webclass/course.php/*`

e-classトップページへ戻るボタンを追加。

**実装方法**
1. 既存の「トップへ戻る」ボタンを検索
2. その隣に「E-class Top」ボタンを挿入
3. `href="/webclass/"` を設定

---

#### course-toc-sidebar.js
**対象**: `*/webclass/course.php/*`

固定目次サイドバーを表示。

**実装方法**
1. タイムライン内のセクションと教材を走査
2. 教材タイプ、未読・新規フラグを判定
3. 固定サイドバーを構築 (`position: fixed`)
4. IntersectionObserverでスクロール連動
5. 現在表示中のセクションをハイライト
6. 自動展開・折りたたみ

**IntersectionObserver設定**
```javascript
const observer = new IntersectionObserver(callback, {
  root: null,
  rootMargin: "-20% 0px -70% 0px",
  threshold: 0
});
```

**使用技術**
- IntersectionObserver API
- DOM操作
- utils/material-icons.js

---

#### course-available-materials.js
**対象**: `*/webclass/course.php/*`

タイムライン上部に教材リストを表示。

**実装方法**
1. タイムライン内の教材を収集
2. セクションごとにグループ化
3. 教材タイプ、未読・新規フラグを判定
4. タイムライン上部に挿入
5. クリックでスクロール

---

### 科目一覧ページ

#### schedule-customizer.js
**対象**: `/webclass/` または `/webclass/index.php*`

時間割表の土曜日列と6・7限行を非表示。

**実装方法**
1. 設定から `hideSaturday`, `hide67thPeriod` を取得
2. テーブルのヘッダー行から「土」を検索
3. 該当列のインデックスを取得
4. すべての行の該当セルに `display: none` を適用
5. 6・7限行も同様に非表示
6. ポップアップからの設定変更を監視

---

#### deadline-list.js + deadline-list.css
**対象**: `/webclass/` または `/webclass/index.php*`

締切が近い課題をサイドバーに一覧表示。

**実装方法**
1. ページ内のすべての課題を走査
2. 締切日時をパース
3. 現在時刻との差を計算
4. 締切が近い順にソート
5. サイドバーウィジェットを作成 (`position: fixed`)
6. 色分け (24時間以内: 赤、3日以内: 黄色)

---

#### collapsible-sections.js + collapsible.css
**対象**: `/webclass/` または `/webclass/index.php*`

セクションを折りたたみ可能にする。

**実装方法**
1. 各セクションの見出しに折りたたみアイコンを追加
2. クリックイベントリスナーを設定
3. セクションの `display` を切り替え
4. アイコンを回転
5. 状態を `chrome.storage.local` に保存
6. ページ読み込み時に状態を復元

---

#### pinned-courses.js + pinned-courses.css
**対象**: `/webclass/` または `/webclass/index.php*`

科目をピン留めして素早くアクセス。

**実装方法**
1. 各科目リンクにピン留めボタンを追加
2. ボタンクリックで科目情報を保存
3. ピン留めウィジェットに表示
4. ピン解除ボタンで削除
5. `chrome.storage.local` でリストを保存

---

### レポートページ

#### content.js
**対象**: `*/my-reports*`

提出済みレポートファイルを新しいタブで開く。

**実装方法**
1. ファイルリンクを検索 (`file_down.php`)
2. クリックイベントをインターセプト
3. `preventDefault()` でデフォルト動作を停止
4. background.jsに `extractRealFileUrl` メッセージを送信
5. background.jsが実ファイルURLを抽出
6. `_preview=1` パラメータを付加
7. 新しいタブで開く

---

### メッセージページ

#### message-tools.js
**対象**: `msg_editor.php*`

「すべて既読にする」ボタンを追加。

**実装方法**
1. ボタンを作成してページ上部に追加
2. クリックですべての未読メッセージIDを収集
3. 各メッセージに対して既読APIリクエストを送信
4. XMLHttpRequestで `POST` リクエスト
5. UI更新 (未読バッジを削除)

---

### 教科書ページ

#### textbook-chapter-buttons.js
**対象**: `txtbk_show_chapter.php*`
**all_frames**: `true`

教科書の各章にボタンを追加。

**ボタン**
- ダウンロード
- 名前を付けて保存
- プレビュー

**実装方法**
1. utils/button-factory.js でボタンを作成
2. 各章のタイトル横に追加
3. background.jsにメッセージを送信
   - `downloadFile` (ダウンロード)
   - `downloadFile` with `saveAs: true` (名前を付けて保存)
   - `createPreviewTab` (プレビュー)

---

#### textbook-loadit-extractor.js
**対象**: `loadit.php?action=providePDF*`
**all_frames**: `true`

教科書PDFのURLを抽出。

**実装方法**
1. `<script>` タグを走査
2. `filedownload()` 関数を検索
3. 正規表現でパラメータを抽出
4. 実ファイルURLを構築
5. background.jsに送信

---

#### attachment-opener.js
**対象**: `loadit.php*`, `txtbk_show_text.php*`, クイズページ
**all_frames**: `true`

添付資料リンクを新しいタブで開く。

**対応パターン**
1. `onclick` 属性を持つリンク → `onclick` を削除し `href` を設定
2. 直リンク → クリックイベントをインターセプト
3. framesetページ → 実URLを抽出

**実装方法**
- `window.open()` を使わず `chrome.runtime.sendMessage()` で新しいタブを開く
- ポップアップを防止

---

### クイズページ

#### quiz-copy-button.js
**対象**: クイズページ
**all_frames**: `true`

個別のクイズ問題をコピー。

**実装方法**
1. 各問題の横に「コピー」ボタンを追加
2. 問題文、選択肢、解答をテキスト形式で整形
3. `navigator.clipboard.writeText()` でコピー
4. フィードバック表示 (「コピー完了！」)

---

#### quiz-export-all.js
**対象**: クイズページ
**all_frames**: `true`

すべてのクイズ内容を一括エクスポート。

**実装方法**
1. ページ上部にボタンを追加
   - 「クリップボードにコピー」
   - 「ファイルに保存」
2. すべての問題を収集・整形
3. クリップボードコピー → `navigator.clipboard.writeText()`
4. ファイル保存 → `Blob` オブジェクトを作成し `<a>` タグの `download` 属性を使用

**ファイル名**: `quiz_export_YYYYMMDD_HHMMSS.txt`

---

## データフロー

### 設定変更
```
ユーザー操作 (popup.html)
  ↓
popup.js (設定保存)
  ↓
chrome.storage.local.set()
  ↓
chrome.tabs.sendMessage() (全タブに通知)
  ↓
content scripts (設定反映)
```

### ファイルダウンロード
```
ユーザー操作
  ↓
content script
  ↓
chrome.runtime.sendMessage()
  ↓
background.js
  ↓
chrome.downloads.download()
  ↓
ファイル保存
```

### プレビュー表示
```
ユーザー操作
  ↓
content script
  ↓
background.js (URLに _preview=1 を付加)
  ↓
chrome.tabs.create()
  ↓
declarativeNetRequest (Content-Disposition削除)
  ↓
ブラウザで表示
```

---

## セキュリティとプライバシー

- すべての処理はブラウザ内で完結
- 外部サーバーへのデータ送信なし
- 設定は `chrome.storage.local` に保存
- HTTPヘッダー操作は `Content-Disposition` のみ

---

## パフォーマンス最適化

- 必要な場所にのみスクリプトを注入 (URL matches)
- 適切な `run_at` 設定
- 冪等性の保証 (複数回実行されても問題なし)
- 効率的なDOM操作
- イベントリスナーの適切な管理

---

最終更新: 2025-12-02
