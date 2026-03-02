# OBF CASE Alignment Importer Sample

Open Badge Factory（OBF）のバッジ編集画面に「CASEから選択」リンクを追加し、CASEフレームワークのアイテムをバッジのアライメントとして登録するChrome/Edge拡張機能のサンプル実装です。

## 概要

[Open Badge Factory](https://openbadgefactory.com/) のバッジ編集画面から、[CASE（Curriculum and Assessment Standards Exchange）](https://www.imsglobal.org/activity/case) フレームワークのアイテムを直接検索・選択してアライメントに追加できます。

現在は**高等学校学習指導要領**（文部科学省 / [OpenSALT](https://opensalt.net/cftree/doc/4007)）のみに対応しています。

## 動作環境

- Chrome または Edge（Manifest V3 対応）
- [Open Badge Factory](https://openbadgefactory.com/) のアカウント

## インストール方法

1. このリポジトリをクローンまたはZIPでダウンロードする
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をオンにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このフォルダを選択する

## 使い方

1. OBF にログインし、バッジの編集画面を開く
2. アライメントセクションの「ESCOから選択」の隣に「CASEから選択」リンクが表示される
3. リンクをクリックしてモーダルを開き、キーワード検索またはフィルタでアイテムを絞り込む
4. 一覧から項目を選択し、右ペインの「バッジに追加」をクリックする
5. バッジを保存すると、アライメントが登録される

## ファイル構成

```
obf-case-sample-extension/
├── manifest.json              # MV3 マニフェスト
├── background.js              # CASE API データ取得・キャッシュ
└── content/
    ├── page-interceptor.js    # XHR インターセプター（MAIN world）
    ├── main.js                # UI・ロジック
    └── modal.css              # モーダルスタイル
```

## 技術的な注意点

- OBF のバッジ保存は Backbone.js（XHR）で行われるため、`page-interceptor.js` を `world: "MAIN"` で実行してリクエストをインターセプトしています
- content script と MAIN world 間の通信はDOMの `<meta>` 要素を介して行っています
- アライメントの重複登録を防ぐため、OBF の既存アライメントをURLで2段階検索しています

詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

## カスタマイズ

別のCASEフレームワークを使用する場合は、`background.js` の `CASE_ENDPOINT` を変更してください。

```javascript
const CASE_ENDPOINT = 'https://your-case-server/ims/case/v1p0/CFPackages/{id}';
```

## ライセンス

Apache License 2.0 — 詳細は [LICENSE](./LICENSE) を参照してください。

© 2026 株式会社インフォザイン
