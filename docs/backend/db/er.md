# Backend DB Schema (SQLite)

## 目的

- バックエンドのDBスキーマを、実装と同じ粒度で可視化する。
- API/サービス変更時に、どのテーブル・カラムへ影響するかを即座に確認できるようにする。

## 変更内容

- 2026-03-03: 運用保持ポリシーを更新（`logs`: 30日 + 200,000件、`jobs`: 30日 + 50,000件）。
- 2026-03-02: `api_tokens.role` と `logs.api_token_id` / `logs.actor_label` を追加（admin認可・監査主体記録）。
- 2026-03-02: `api_tokens` を追加（端末別 Bearer トークン認証）。
- 2026-03-01: Alembic/SQLiteの実DDLに合わせてインデックス記述を更新（`DESC` 明記を削除）。
- 2026-03-01: `logs.event_kind` を追加し、定期ステータス確認の識別を `action` から分離。
- 2026-03-01: uptime詳細メモを `docs/backend/db/uptime-tables.md` へ集約（本ページは全体ER中心に整理）。
- 2026-02-27: 実クエリに合わせてインデックスを再設計（`logs/jobs/status_history/uptime_daily_summary`）。
- 2026-02-27: ER図を `ER図（全体）` 1つに統合。
- 2026-02-24: 現行スキーマ（`pcs` / `logs` / `jobs`）のER図を追加。
- `pcs.mac_address` は `UNIQUE INDEX (uq_pcs_mac_address)` で重複不可。
- 2026-02-25: uptime機能向けに `status_history` / `uptime_daily_summary` を追加。

## ER図（全体）

```mermaid
erDiagram
    pcs {
        TEXT id PK
        TEXT name
        TEXT mac_address "UNIQUE"
        TEXT ip_address "NOT NULL"
        TEXT tags_json
        TEXT note
        TEXT status
        TEXT last_seen_at
        TEXT broadcast_ip
        TEXT send_interface
        INTEGER wol_port
        TEXT status_method
        INTEGER status_port
        TEXT created_at
        TEXT updated_at
    }

    status_history {
        INTEGER id PK
        TEXT pc_id FK
        TEXT status
        INTEGER is_online
        TEXT changed_at
        TEXT source
        TEXT note
        TEXT created_at
    }

    uptime_daily_summary {
        TEXT pc_id FK
        TEXT date
        TEXT tz
        INTEGER online_seconds
        INTEGER online_count
        INTEGER offline_count
        TEXT first_online_at
        TEXT last_online_at
        TEXT created_at
        TEXT updated_at
        "PK (pc_id, date, tz)"
    }

    logs {
        INTEGER id PK
        TEXT pc_id FK
        TEXT job_id
        TEXT api_token_id
        TEXT actor_label
        TEXT action
        TEXT event_kind
        INTEGER ok
        TEXT status
        TEXT message
        TEXT error_code
        TEXT details_json
        TEXT created_at
    }

    jobs {
        TEXT id PK
        TEXT job_type
        TEXT state
        TEXT payload_json
        TEXT result_json
        TEXT error_message
        TEXT created_at
        TEXT started_at
        TEXT finished_at
        TEXT updated_at
    }

    api_tokens {
        TEXT id PK
        TEXT name
        TEXT role
        TEXT token_hash "UNIQUE"
        TEXT token_prefix
        TEXT created_at
        TEXT expires_at
        TEXT last_used_at
        TEXT revoked_at
    }

    pcs ||--o{ logs : "logs.pc_id -> pcs.id (ON DELETE SET NULL)"
    jobs ||--o{ logs : "logs.job_id -> jobs.id (logical reference)"
    pcs ||--o{ status_history : "status_history.pc_id -> pcs.id (ON DELETE CASCADE)"
    pcs ||--o{ uptime_daily_summary : "uptime_daily_summary.pc_id -> pcs.id (ON DELETE CASCADE)"
```

## 実クエリ整合インデックス（主要）

- `pcs`
  - `idx_pcs_status_id (status, id ASC)`: statusフィルタ + カーソルページング
- `logs`
  - `idx_logs_pc_id_desc (pc_id, id)`: `pc_id` 絞り込み + 新しい順（逆順走査）
  - `idx_logs_action_id_desc (action, id)`: `action` 絞り込み + 新しい順（逆順走査）
  - `idx_logs_ok_id_desc (ok, id)`: 成否絞り込み + 新しい順（逆順走査）
  - `idx_logs_job_id_id_desc (job_id, id)`: `job_id` 単位のログ取得 + 新しい順（逆順走査）
  - `idx_logs_api_token_id_id_desc (api_token_id, id)`: トークン主体別ログ取得 + 新しい順（逆順走査）
  - `idx_logs_event_kind_id_desc (event_kind, id)`: 種別別ログ取得（定期/通常） + 新しい順（逆順走査）
  - `idx_logs_created_at (created_at)`: 保持期間削除、`since/until` 範囲条件
- `jobs`
  - `idx_jobs_job_type_state_created_at (job_type, state, created_at)`: 同種ジョブの `queued/running` 最新取得
- `api_tokens`
  - `uq_api_tokens_token_hash (token_hash UNIQUE)`: トークン照合の一意性担保
  - `idx_api_tokens_name (name)`: 管理画面での検索/表示
  - `idx_api_tokens_revoked_expires (revoked_at, expires_at)`: 有効トークン判定（失効/期限）検索
  - `idx_api_tokens_role_revoked_expires (role, revoked_at, expires_at)`: role別の有効トークン判定

## 運用時の注意点

- `pcs.mac_address` は起動時マイグレーションで正規化される（`AA:BB:CC:DD:EE:FF` 形式）。
- `pcs.ip_address` は必須（`NOT NULL`）。`NULL/空文字` 行がある状態では `3f2a6df9d4a1` マイグレーションが失敗するため、事前に補正または削除が必要。
- 既存データに同一MACの重複があると、一意制約作成時に起動エラーになる。重複解消後に再起動する。
- 保持期間方針:
  - `logs`: 30日保持 + 200,000件上限（挿入時に自動削除）。
  - `jobs`: 30日保持 + 50,000件上限（新規ジョブ作成時に自動削除、`queued/running` は保護）。
  - `status_history`: 5年保持（定期削除）。
  - `uptime_daily_summary`: 無期限保持。
- スキーマ変更時は、このページと `docs/backend/api/openapi.md` を同時更新する。
