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
