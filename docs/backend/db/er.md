# Backend DB Schema (SQLite)

## 目的

- バックエンドのDBスキーマを、実装と同じ粒度で可視化する。
- API/サービス変更時に、どのテーブル・カラムへ影響するかを即座に確認できるようにする。

## 変更内容

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
        TEXT ip_address
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
        TEXT action
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

    pcs ||--o{ logs : "logs.pc_id -> pcs.id (ON DELETE SET NULL)"
    pcs ||--o{ status_history : "status_history.pc_id -> pcs.id (ON DELETE CASCADE)"
    pcs ||--o{ uptime_daily_summary : "uptime_daily_summary.pc_id -> pcs.id (ON DELETE CASCADE)"
```

## テーブル設計メモ（uptime）

- `status_history`
  - 用途: 状態変化イベントを時系列保存し、週タイムラインの区間生成に使う。
  - 保存ルール: 前回状態から変化したときのみ1レコード追加。
  - `is_online`: `status == online` のとき `1`、それ以外は `0`。
  - 推奨インデックス:
    - `idx_status_history_pc_changed_id (pc_id, changed_at DESC, id DESC)`
    - `idx_status_history_changed_at (changed_at DESC)`

- `uptime_daily_summary`
  - 用途: 日次グラフ表示向けの集計結果を保持。
  - 1日1PC1行（`pc_id + date + tz` を主キー）。
  - `online_seconds` は 0..86400。`online_ratio` はAPIで算出して返却。
  - 推奨インデックス:
    - `idx_uptime_daily_summary_pc_tz_date (pc_id, tz, date ASC)`

## 実クエリ整合インデックス（主要）

- `pcs`
  - `idx_pcs_status_id (status, id ASC)`: statusフィルタ + カーソルページング
- `logs`
  - `idx_logs_pc_id_desc (pc_id, id DESC)`: `pc_id` 絞り込み + 新しい順
  - `idx_logs_action_id_desc (action, id DESC)`: `action` 絞り込み + 新しい順
  - `idx_logs_ok_id_desc (ok, id DESC)`: 成否絞り込み + 新しい順
  - `idx_logs_created_at (created_at)`: 保持期間削除、`since/until` 範囲条件
- `jobs`
  - `idx_jobs_job_type_state_created_at (job_type, state, created_at DESC)`: 同種ジョブの `queued/running` 最新取得

## 運用時の注意点

- `pcs.mac_address` は起動時マイグレーションで正規化される（`AA:BB:CC:DD:EE:FF` 形式）。
- 既存データに同一MACの重複があると、一意制約作成時に起動エラーになる。重複解消後に再起動する。
- 保持期間方針:
  - `status_history`: 1年保持（定期削除）。
  - `uptime_daily_summary`: 無期限保持。
- スキーマ変更時は、このページと `docs/backend/api/openapi.md` を同時更新する。
