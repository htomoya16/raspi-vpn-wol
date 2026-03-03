# Cache Feature

## 目的

- 稼働時間APIと一覧APIの応答速度を上げつつ、表示鮮度を落とさないキャッシュ方針を定義する。
- 副作用API（WOL/更新系）実行後の不整合を防ぐため、無効化ルールを明文化する。

## 変更内容

- キャッシュを3層で扱う設計にする。
- レイヤ1: DB集計キャッシュ（実装済み）
  - `uptime_daily_summary` を `pc_id + date + tz` 単位で保持する。
  - `GET /api/pcs/{pc_id}/uptime/summary` で read-through 更新する。
  - 保持期間外（`status_history` より古い範囲）は `uptime_daily_summary` を優先して返す。
- レイヤ2: API応答メモリキャッシュ（実装済み）
  - 対象: `GET /api/pcs`, `GET /api/pcs/{pc_id}/uptime/summary`, `GET /api/pcs/{pc_id}/uptime/weekly`。
  - 非対象: `status/logs/jobs`（鮮度優先）。
  - メモリ上限: `1000` エントリ（超過時は最古エントリから削除）。
  - 期限切れ掃除: `60s` 間隔で実施。
- レイヤ3: HTTPキャッシュ制御（実装済み）
  - ブラウザ側が誤って長期保持しないよう `Cache-Control` をAPI単位で設定する。

### API別キャッシュ方針（設計値）

- `GET /api/pcs`
  - メモリキャッシュ: `TTL 30s`
  - `Cache-Control`: `private, max-age=10, stale-while-revalidate=20`
- `GET /api/pcs/{pc_id}/uptime/summary`
  - メモリキャッシュ: `TTL 120s`
  - `Cache-Control`: `private, max-age=30, stale-while-revalidate=90`
- `GET /api/pcs/{pc_id}/uptime/weekly`
  - メモリキャッシュ: `TTL 120s`
  - `Cache-Control`: `private, max-age=30, stale-while-revalidate=90`
- `GET /api/logs`, `GET /api/jobs/{job_id}`, `POST /api/pcs/{pc_id}/status/refresh` 結果参照系
  - メモリキャッシュ: なし
  - `Cache-Control`: `no-store`

### 無効化ルール（設計値）

- PC作成/更新/削除成功時:
  - `pcs:list:*`
  - `uptime:summary:{pc_id}:*`（削除時は対象IDのみ）
  - `uptime:weekly:{pc_id}:*`
- WOL送信受付成功時:
  - `pcs:list:*`
  - `uptime:summary:{pc_id}:*`
  - `uptime:weekly:{pc_id}:*`
- 単体/全体ステータス更新完了時:
  - 更新対象PCの uptime キャッシュ
  - `pcs:list:*`

### 実装内容（2026-02-27）

1. `app/cache/memory_cache.py` を追加し、TTL付き in-process メモリキャッシュを実装。
2. `app/cache/keys.py` を追加し、キー命名規約と prefix 無効化ルールを定義。
3. `pc_service` の `list_pcs/get_uptime_summary/get_weekly_timeline` を read-through 化。
4. 変異系（PC CRUD/WOL/status更新）で `pcs` / `uptime` キャッシュ無効化を実装。
5. APIレスポンスへ `Cache-Control` を設定。
6. `backend/tests/services/test_cache_memory.py` と既存API/Serviceテストにキャッシュ検証を追加。
7. `GET /api/logs` / `GET /api/jobs/{job_id}` に `Cache-Control: no-store` を明示し、仕様と実装を一致させた。

## 運用時の注意点

- 現在の in-process キャッシュは単一プロセス前提。将来 multi-worker 化する場合は Redis 等へ移行する。
- キャッシュTTLを伸ばしすぎると、WOL直後の見た目が古くなるため、まず短TTLで運用する。
- `uptime_daily_summary` は「永続化された集計結果」であり、HTTPキャッシュとは役割が異なる。
