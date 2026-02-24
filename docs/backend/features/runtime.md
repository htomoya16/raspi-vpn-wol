# Runtime and DB Init

## 目的

- バックエンド起動時の初期化手順と、稼働中の基本エンドポイントを整理する。
- vNext API の実装前提となる初期DBスキーマを明文化する。

## 変更内容

- `app.main` の `lifespan` で起動時に `init_db()` を実行。
- `lifespan` で 60秒間隔の定期ステータス監視タスクを起動する。
- `init_db()` で `pcs` / `logs` / `jobs` を `CREATE TABLE IF NOT EXISTS`。
- 初期スキーマ方針:
  - `pcs`: PC設定 + 状態保持
  - `logs`: 操作履歴
  - `jobs`: 非同期ジョブ状態
- `logs.pc_id` は `pcs.id` への外部キー（`ON DELETE SET NULL`）。
- `GET /api/health` を提供し、`{"status":"ok"}` を返す。

## 運用時の注意点

- 現在は「初期化前提」のため、スキーマ変更時は `app.db` 再作成で追従する。
- DBファイルは `backend/app/db/app.db`。
- `health` はアプリ生存確認のみで、外部依存（LAN疎通等）は検査しない。
- 起動直後にAPI異常がある場合は `init_db()` の例外有無を最優先で確認する。
- 複数ワーカーで起動した場合は、ワーカー数ぶん監視タスクが立ち上がる点に注意する。
