# OBF CASE Alignment Importer Sample

A sample Chrome/Edge extension that adds a "Pick from CASE" link to the Open Badge Factory badge editor, allowing you to search and select items from a CASE framework and register them as badge alignments.

## Overview

From the [Open Badge Factory](https://openbadgefactory.com/) badge editor, you can search and select items from a [CASE (Curriculum and Assessment Standards Exchange)](https://www.imsglobal.org/activity/case) framework and add them directly as alignments.

Currently supports the **Japanese High School Course of Study** (MEXT / [OpenSALT](https://opensalt.net/cftree/doc/4007)) only.

## Requirements

- Chrome or Edge (Manifest V3)
- An [Open Badge Factory](https://openbadgefactory.com/) account

## Installation

1. Clone this repository or download it as a ZIP
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Usage

1. Log in to OBF and open a badge editor
2. A **"Pick from CASE"** link will appear next to the existing "Pick from ESCO" link in the alignments section
3. Click the link to open the modal, then search by keyword or filter by item type
4. Select an item from the list and click **"Add to badge"** in the right pane
5. Save the badge — the alignment will be registered

## File Structure

```
obf-case-sample-extension/
├── manifest.json              # MV3 manifest
├── background.js              # CASE API fetch and cache
└── content/
    ├── page-interceptor.js    # XHR interceptor (MAIN world)
    ├── main.js                # UI and logic
    └── modal.css              # Modal styles
```

## Technical Notes

- OBF saves badges via Backbone.js (XHR), so `page-interceptor.js` runs in `world: "MAIN"` to intercept requests
- Communication between the content script and MAIN world is handled through a shared DOM `<meta>` element
- To prevent duplicate alignments, existing OBF alignments are checked in two steps using the alignment URL

See [CLAUDE.md](./CLAUDE.md) for full technical details.

## Limitations

**This extension is a workaround, not a standards-compliant CASE integration.**

OBF currently implements the Open Badges **2.0** alignment schema. The CASE-specific fields defined in Open Badges **3.0** (`targetFramework`, `targetCode`, `targetType`, etc.) are not supported by OBF. As a result, CASE data is mapped to the available OB 2.0 fields as follows:

| OBF field | What is stored | OBv3 equivalent |
|---|---|---|
| `name` | `CFItem.fullStatement` | `targetName` |
| `url` | `https://opensalt.net/uri/{identifier}` | `targetUrl` |
| `description` | `CFItem.notes` or `CFItem.CFItemType` | `targetDescription` |
| `framework` | *(empty — OBF validation issue)* | `targetFramework` |
| `code` | *(empty — OBF validation issue)* | `targetCode` |

`targetType: "CFItem"` and `targetFramework` have no corresponding field in OBF's current UI and are not stored.

If OBF adds official OBv3 + CASE support in the future, this extension will need to be reworked accordingly.

## Customization

To use a different CASE framework, update `CASE_ENDPOINT` in `background.js`:

```javascript
const CASE_ENDPOINT = 'https://your-case-server/ims/case/v1p0/CFPackages/{id}';
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for details.

© 2026 Infosign, Inc.

---

# OBF CASE Alignment Importer Sample（日本語）

[Open Badge Factory](https://openbadgefactory.com/) のバッジ編集画面に「CASEから選択」リンクを追加し、CASEフレームワークのアイテムをバッジのアライメントとして登録するChrome/Edge拡張機能のサンプル実装です。

## 概要

バッジ編集画面から、[CASE（Curriculum and Assessment Standards Exchange）](https://www.imsglobal.org/activity/case) フレームワークのアイテムを直接検索・選択してアライメントに追加できます。

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

## 制約・注意事項

**本拡張機能は暫定的な回避策であり、CASE の正式な標準実装ではありません。**

OBF は現在 Open Badges **2.0** のアライメントスキーマを使用しています。Open Badges **3.0** で定義されている CASE 対応フィールド（`targetFramework`・`targetCode`・`targetType` 等）は OBF に存在しないため、CASE データを既存の OB 2.0 フィールドに次のように割り当てています。

| OBF フィールド | セットされる値 | OBv3 での対応 |
|---|---|---|
| `name` | `CFItem.fullStatement`（例: "国語"）| `targetName` |
| `url` | `https://opensalt.net/uri/{identifier}` | `targetUrl` |
| `description` | `CFItem.notes` または `CFItem.CFItemType` | `targetDescription` |
| `framework` | **空**（OBF のバリデーション制約のため）| `targetFramework` |
| `code` | **空**（OBF のバリデーション制約のため）| `targetCode` |

`targetType: "CFItem"` および `targetFramework` に相当するフィールドは OBF の現 UI に存在しないため、保存されません。

将来 OBF が OBv3 + CASE に正式対応した場合、本拡張機能の大幅な見直しが必要になります。

## カスタマイズ

別のCASEフレームワークを使用する場合は、`background.js` の `CASE_ENDPOINT` を変更してください。

```javascript
const CASE_ENDPOINT = 'https://your-case-server/ims/case/v1p0/CFPackages/{id}';
```

## ライセンス

Apache License 2.0 — 詳細は [LICENSE](./LICENSE) を参照してください。

© 2026 株式会社インフォザイン
