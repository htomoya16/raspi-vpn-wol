# Runtime and DB Init

## 目的

- バックエンド起動時の初期化手順と、稼働中の基本エンドポイントを整理する。
- 既存DBを壊さない最小マイグレーション挙動を明文化する。

## 変更内容

- `app.main` の `lifespan` で起動時に `init_db()` を実行。
- `init_db()` で `targets` / `logs` を `CREATE TABLE IF NOT EXISTS`。
- 既存DB向けに `send_interface` カラム追加マイグレーションを実施。
- `GET /api/health` を提供し、`{"status":"ok"}` を返す。

## 運用時の注意点

- DBスキーマ更新時は、既存DBが起動時に追従できるマイグレーションを必ず用意する。
- `health` はアプリ生存確認のみで、外部依存（LAN疎通等）は検査しない。
- 起動直後にAPI異常がある場合は `init_db()` の例外有無を最優先で確認する。
