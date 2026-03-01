# Device Bearer Token Auth

## 目的

- VPN 内アクセス前提に加えて、端末単位で API 利用を制御できる認証基盤を定義する。
- iPhone ショートカットなどの自動化クライアントを、安全に運用できるようにする。

## 変更内容

- 2026-03-02: 端末別 Bearer トークン認証の v1 仕様を追加。
- 2026-03-02: トークン管理 API（一覧/作成/失効）と管理画面 MVP 方針を追加。
- 2026-03-02: Backend 実装（`api_tokens` / Bearer ガード / 管理 API / API テスト）を反映。
- 2026-03-02: admin 専用化（role分離 / CLI復旧経路 / 監査ログ主体記録）を実装反映。

## 認証仕様（v1）

- ヘッダー:
  - `Authorization: Bearer <token>`
- SSE 例外:
  - `GET /api/events` のみ `?token=<bearer>` を許可する（EventSource が `Authorization` ヘッダーを付与できないため）。
- 適用範囲:
  - `/api/health` を除く `/api/*` 全エンドポイント
- 判定:
  - 有効トークン: 通過
  - 未指定 / 不正形式 / 不一致 / 失効 / 期限切れ: `401`
- エラーレスポンス:
  - `{"detail":"invalid bearer token"}`
- ブートストラップ:
  - 有効トークンが 0 件の間は認証を一時バイパスし、初回発行を可能にする。

## 管理APIの認可

- 目的:
  - `/api/admin/*` を admin トークン専用にし、通常端末トークン（device）と権限分離する。
- 認可ルール:
  - 業務API（`/api/pcs` など）: `admin` / `device` の両方許可。
  - 管理API（`/api/admin/*`）: `admin` のみ許可。
- エラーレスポンス:
  - 認証失敗: `401 {"detail":"invalid bearer token"}`
  - 認可失敗: `403 {"detail":"insufficient scope"}`
- 補足:
  - 初回ブートストラップ（有効トークン 0 件）で作成される最初のトークンは、ロックアウト防止のため `admin` とする。
  - admin ロールの有効トークンが 1 件だけのとき、そのトークンの失効は API で拒否する。

## トークン管理モデル（DB）

- テーブル名: `api_tokens`
- カラム（最小）:
  - `id` (text, PK)
  - `name` (text, NOT NULL) 例: `iphone-action-button`
  - `token_hash` (text, NOT NULL) 平文保存は禁止
  - `token_prefix` (text, NOT NULL) 表示識別子（先頭数文字）
  - `created_at` (text, NOT NULL)
  - `expires_at` (text, nullable)
  - `last_used_at` (text, nullable)
  - `revoked_at` (text, nullable)
- `role` (text, NOT NULL, `admin|device`)
- インデックス（最小）:
  - `name`（運用検索用）
  - `revoked_at`（有効トークン探索用）
  - `expires_at`（期限切れ判定用）
- `role + revoked_at + expires_at`（role別の有効判定検索）

## `token_prefix` の定義

- `token_prefix` は認証用ではなく、管理画面の表示・照合補助のために使う。
- 保存例:
  - 平文トークン: `tok_7f4f9d9b3a...`
  - 保存値: `tok_7f4f`（先頭8文字など）
- 目的:
  - 「どのトークンを失効するか」を運用者が判断しやすくする。

## 端末の区別方法

- 端末識別は `name` と `id` で行う（User-Agent は補助情報）。
- 1端末1トークンを原則にする。
- 端末トークン漏えい時は、対象レコードのみ失効して影響を局所化する。

## 発行・失効フロー（v1）

- v1 は管理 API + 管理画面 MVP で発行/失効する。
- 発行時のみ平文トークンを 1 回表示し、再表示はしない。
- 失効は `revoked_at` 設定で実施し、物理削除しない（監査目的）。

## 管理 API（v1）

- `GET /api/admin/tokens`
  - 用途: 一覧取得（`name`, `token_prefix`, `last_used_at`, `expires_at`, `revoked_at`）。
- `POST /api/admin/tokens`
  - 用途: 新規発行。
  - 入力: `name`, `role`（任意）, `expires_at`（任意）。
  - role 指定なし時: 通常は `device`、ただし初回作成時は `admin`。
  - 出力: 平文トークンをこのレスポンスで 1 回だけ返す。
- `POST /api/admin/tokens/{token_id}/revoke`
  - 用途: 失効（ソフトデリート）。
  - 動作: `revoked_at` を設定し、以後は認証不可にする。
  - 制約: 最後の有効 admin トークンは失効不可（`400`）。
- `DELETE /api/admin/tokens/{token_id}`
  - 用途: 物理削除。
  - 制約: 失効済みトークン（`revoked_at != null`）のみ削除可能（未失効は `400`）。

## CRUD 方針（v1.1）

- 採用: `Create` / `Read` / `Revoke` / `Delete`
- 制約:
  - 物理 `Delete` は失効済みトークンのみ許可
- 非採用:
  - `Update`（`name`/`expires_at` 更新）は v1.1 でも不要
- 理由:
  - 通常運用は失効で監査履歴を残しつつ、不要になった失効済みトークンのみ整理できるため。

## 管理画面（MVP）

- 設定画面に「API トークン管理」を追加する。
- 最小機能:
  - 一覧表示（端末名/prefix/最終利用/有効期限/状態）
  - 発行フォーム（`name`, `role`, `expires_at`）
  - 失効ボタン / 失効済みトークン削除ボタン（確認ダイアログ付き）
  - 発行直後の平文トークン表示（1回のみ）
- `admin` 以外のトークンで管理 API を呼ぶと `403` になるため、UI側でも制御が必要。

## ブラウザ保存の扱い

- フロントは Bearer トークンを `localStorage`（`wol:api-bearer-token`）へ保存して自動送信する。
- 保存期限はブラウザ側では無期限（削除/上書きまで残る）。
- 実際の利用可否はサーバー側トークン状態（失効/期限切れ）で判定される。

## admin全損時の復旧

- 前提:
  - admin 専用化後は、admin トークンが 0 件だと `/api/admin/*` から復旧できない。
- 復旧経路:
  - サーバー上 CLI で admin トークンを再発行する。
  - 例: `python scripts/create_api_token.py --role admin --name break-glass-admin`
- 運用ルール:
  - admin トークンは常時 2 件以上を維持する。
  - 「最後の admin 失効」を API 側で禁止する。

## ログ連携（監査）

- `logs` へ実行主体を記録する。
- 記録項目:
  - `api_token_id`（どのトークンで呼んだか）
  - `actor_label`（表示用の端末名）
- 目的:
  - 「どの端末がいつ WOL を投げたか」を追跡できるようにする。

## セキュリティ要件

- トークン比較は定数時間比較で行う。
- 平文トークンは DB 保存しない。
- ログに平文トークンを出力しない。
- トークンは 32 byte 以上のランダム値を推奨する。

## 実装状態

- 実装済み:
  - Alembic: `api_tokens` テーブル追加
  - Alembic: `api_tokens.role` / `logs.api_token_id` / `logs.actor_label` を追加
  - FastAPI: Bearer 検証依存（`/api/health` 除外）と admin 専用依存（`/api/admin/*`）
  - 管理 API: 一覧 / 発行（role対応） / 失効（last admin 保護）
  - 管理 API: 失効済みトークン削除（`DELETE /api/admin/tokens/{token_id}`）
  - CLI: `scripts/create_api_token.py`（break-glass 復旧）
  - tests: 認証・認可・監査ログ主体・CLI の回帰テスト
  - フロント: role選択 / admin専用表示制御 / 失効済み削除確認ダイアログ
  - docs: API/DB/Backend 入口の更新

## 運用時の注意点

- 端末紛失時は即時失効する。
- 端末ごとに用途を `name` へ含める（例: `iphone-shortcut-wol`）。
- 有効期限なしトークンを運用する場合でも、定期ローテーション日を決める。
