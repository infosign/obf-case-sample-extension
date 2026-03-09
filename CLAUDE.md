# OBF CASE Alignment Importer

## 概要
Open Badge Factory（OBF）のバッジ編集画面に「CASEから選択」リンクを追加し、
CASEフレームワークのアイテムをバッジのアライメントとして紐付ける Chrome/Edge 拡張機能。

## 対象画面
バッジ編集画面のみ: `https://openbadgefactory.com/c/badge/*/edit`

## ファイル構成
- `manifest.json` — MV3 マニフェスト（パーミッション: host_permissions のみ）
- `background.js` — CASE APIデータの取得とインメモリキャッシュ
- `content/page-interceptor.js` — fetch/XHR インターセプター（MAIN world）
- `content/main.js` — UI・ロジック（isolated world）
- `content/modal.css` — モーダルスタイル

## 技術的なポイント

### なぜ MAIN world が必要か
OBFはバッジ保存時に Backbone.sync（jQuery $.ajax = XHR）でPOSTする。
content scriptのisolated worldからはXHRプロトタイプを書き換えられないため、
`page-interceptor.js` を `world: "MAIN"` + `run_at: "document_start"` で実行する。

### content script ↔ MAIN world 通信
両者は JavaScript コンテキストが分離されているが、DOMは共有している。
`<meta id="__case_pending__" data-ids='["ID1","ID2"]'>` をDOMに置くことで
content script（main.js）→ MAIN world（page-interceptor.js）にIDを渡す。

### OBF の CSP 制約
インラインスクリプト（`<script>` タグ動的注入）はCSPでブロックされる。
→ manifest宣言の外部ファイルでのみ MAIN world スクリプトを実行できる。

### バッジ保存のインターセプト
`/c/badge/{id}/edit` への POST をインターセプト。
リクエストボディはJSON: `{"language":"ja","alignment":{"ja":{}},...}`
`patchBody()` でアライメントIDを注入してから元のXHR.sendを呼ぶ。

### アライメントの重複排除（2段階）
OBFのアライメント一覧は動的読み込み（OBFGridAlignment / `/c/grid/list/alignment`）。
レスポンスはNDJSON形式で `id, name, mtime, ctime, category` のみ（URLなし）。
重複排除の手順:
1. `/c/grid/list/alignment` で名前一致の候補を絞り込む
2. 候補の `/c/alignment/{id}/edit` ページで `input[name="url"]` を照合
同じCASEアイテムならURLが一致するため、既存IDを再利用して新規作成をスキップ。

### 「CASEから選択」リンクの維持
OBFはSPAでセクションを頻繁に再描画するため、リンクが消える。
MutationObserver + setInterval(800ms) の二重監視で継続的に再挿入する。

## 現在のCASEフレームワーク（固定）

| 項目 | 値 |
|---|---|
| 名称 | 高等学校学習指導要領 |
| 作成者 | 文部科学省 |
| CFPackage API | `https://opensalt.net/ims/case/v1p0/CFPackages/d86774f2-8982-4366-8d72-c4d3889d8171` |
| UIブラウザ | `https://opensalt.net/cftree/doc/4007` |

エンドポイントは `background.js` の `CASE_ENDPOINT` 定数に直書きされている。

## 未対応事項
- 複数CASEフレームワーク対応（現在は高等学校学習指導要領のみ固定）
- アライメント一覧・新規作成ページへの機能追加

## 現実装の制約：OBv3 CASE対応との差異

本実装は OBF の既存アライメント登録 UI をハックしているものであり、
Open Badges 3.0 が規定する正式な CASE 対応（`targetFramework` 等）とは異なる。

### OBF が使用しているアライメントスキーマ（Open Badges 2.0）

| OBF フォームフィールド | 種別 | 本実装でのセット値 |
|---|---|---|
| `name` | テキスト（必須） | `CFItem.fullStatement`（例: "国語"）|
| `url` | テキスト（必須） | `https://opensalt.net/uri/{CFItem.identifier}`（※後述）|
| `description` | テキストエリア | `CFItem.notes`（空なら `CFItem.CFItemType`）|
| `framework` | hidden | **空**（後述の理由によりセットしていない）|
| `code` | hidden | **空**（後述の理由によりセットしていない）|

### OBv3 の正式な Alignment オブジェクトとの比較

Open Badges 3.0 では Alignment に以下のフィールドが定義されているが、
現在の OBF は OB 2.0 ベースのため、これらのフィールドは存在しない。

| OBv3 フィールド | CASE での対応値 | OBF での現状 |
|---|---|---|
| `targetName` | `CFItem.fullStatement` | `name` フィールドで代替 |
| `targetUrl` | `CFItem.uri` | `url` フィールドで代替 |
| `targetDescription` | `CFItem.notes` | `description` フィールドで代替 |
| `targetFramework` | `CFDocument.title` | **未対応**（OBF に該当フィールドなし）|
| `targetCode` | `CFItem.humanCodingScheme` | **未対応**（`code` hidden フィールドは内部ID期待のため空）|
| `targetType` | `"CFItem"` | **未対応** |

### 補足

- **`url` の値について**: `CFItem.uri`（`satchel.commongoodlt.com`）は実証環境では無効なため、
  `identifier` から `https://opensalt.net/uri/{identifier}` を手動で組み立てている。
- **`framework` / `code` が空の理由**: OBF の `framework` hidden フィールドは自由テキストではなく
  内部ID（もしくは特定の形式）を期待している可能性があり、自由テキストを入れるとバリデーションエラーになる。
  OBF への問い合わせが解決するまで空で送信している。
- 本実装は OBF の正式APIが存在しないための暫定ハックである。
  将来 OBF が OBv3 + CASE に正式対応した場合、実装の大幅な見直しが必要になる。
