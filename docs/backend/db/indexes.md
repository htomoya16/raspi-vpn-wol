# Backend Index Guide

## 目的

- 現在のインデックス設計と、実クエリとの対応を1ページで確認できるようにする。
- クエリ変更時に、どのインデックスを見直すべきか判断しやすくする。

## 変更内容

- 2026-02-27: 現行のインデックス一覧と、対応クエリを整理。
- 2026-02-27: `EXPLAIN QUERY PLAN` の確認手順を追加。

## インデックス一覧（現行）

- `uq_pcs_mac_address` on `pcs(mac_address)` (UNIQUE)
- `idx_logs_pc_id_desc` on `logs(pc_id, id DESC)`
- `idx_logs_action_id_desc` on `logs(action, id DESC)`
- `idx_logs_ok_id_desc` on `logs(ok, id DESC)`
- `idx_logs_created_at` on `logs(created_at)`
- `idx_jobs_job_type_state_created_at` on `jobs(job_type, state, created_at DESC)`
- `idx_status_history_pc_changed_id` on `status_history(pc_id, changed_at DESC, id DESC)`
- `idx_status_history_changed_at` on `status_history(changed_at DESC)`
- `idx_uptime_daily_summary_pc_tz_date` on `uptime_daily_summary(pc_id, tz, date ASC)`

## 実クエリとの対応

- `uq_pcs_mac_address`
  - 対応: `backend/app/repositories/pc_repository.py` の `WHERE mac_address = ?`
  - 目的: MAC重複防止と単体検索高速化

- `idx_logs_pc_id_desc`
  - 対応: `backend/app/repositories/log_repository.py` の `WHERE pc_id = ?` + `ORDER BY id DESC`
  - 目的: PC単位ログの新しい順取得

- `idx_logs_action_id_desc`
  - 対応: `backend/app/repositories/log_repository.py` の `WHERE action = ?` + `ORDER BY id DESC`
  - 目的: Action単位ログの新しい順取得

- `idx_logs_ok_id_desc`
  - 対応: `backend/app/repositories/log_repository.py` の `WHERE ok = ?` + `ORDER BY id DESC`
  - 目的: 成否別ログの新しい順取得

- `idx_logs_created_at`
  - 対応: `backend/app/repositories/log_repository.py` の `WHERE created_at >= ? / <= ?`
  - 対応: `backend/app/repositories/log_repository.py` の保持期間削除（古いログ削除）
  - 目的: 時刻範囲検索と保守削除の効率化

- `idx_jobs_job_type_state_created_at`
  - 対応: `backend/app/repositories/job_repository.py` の `WHERE job_type = ? AND state IN (...) ORDER BY created_at DESC LIMIT 1`
  - 目的: 同種ジョブのアクティブ最新1件取得

- `idx_status_history_pc_changed_id`
  - 対応: `backend/app/repositories/uptime_repository.py` の最新状態取得と期間履歴取得
  - 条件: `WHERE pc_id = ? AND changed_at ...` + `ORDER BY changed_at, id`
  - 目的: PCごとの時系列履歴探索を高速化

- `idx_status_history_changed_at`
  - 対応: `backend/app/repositories/uptime_repository.py` の保持期間削除
  - 条件: `WHERE changed_at < ?`
  - 目的: 古い履歴の削除対象探索を高速化

- `idx_uptime_daily_summary_pc_tz_date`
  - 対応: `backend/app/repositories/uptime_repository.py` の `list_daily_summary`
  - 条件: `WHERE pc_id = ? AND tz = ? AND date >= ? AND date <= ? ORDER BY date ASC`
  - 目的: 稼働集計の期間取得を高速化

## なぜ速くなるか

- インデックス先頭列が `WHERE` 条件と一致すると、全件走査を避けやすい。
- `ORDER BY` の並びがインデックス順と一致すると、追加ソートを避けやすい。
- 不要インデックスを減らすと、`INSERT/UPDATE/DELETE` 時の更新コストを抑えられる。

## 確認方法（EXPLAIN QUERY PLAN）

- 何をする: SQLの実行計画を表示し、`USING INDEX` を確認する。
- コマンド例:

```sql
EXPLAIN QUERY PLAN
SELECT id, pc_id, action, ok, created_at
FROM logs
WHERE pc_id = 'pc-main'
ORDER BY id DESC
LIMIT 50;
```

- 見方:
  - `SEARCH ... USING INDEX ...` が出る: インデックス利用
  - `SCAN ...` のみ: 全件走査の可能性が高い

## 実行結果メモ（2026-02-27）

- 対象: logs一覧（`pc_id` 指定 + `ORDER BY id DESC`）
  - 結果: `SEARCH logs USING INDEX idx_logs_pc_id_desc (pc_id=?)`
  - 判定: 想定どおりインデックス利用

- 対象: jobs最新取得（`job_type` + `state IN (...)` + `ORDER BY created_at DESC`）
  - 結果:
    - `SEARCH jobs USING INDEX idx_jobs_job_type_state_created_at (job_type=? AND state=?)`
    - `USE TEMP B-TREE FOR ORDER BY`
  - 判定: 絞り込みにはインデックス利用、最終ソートで一時B-Treeを使用
  - 改善候補: `job_type + created_at DESC` 系の追加インデックス検討

- 対象: status_history期間取得（`pc_id` + `changed_at` 範囲 + `ORDER BY changed_at,id`）
  - 結果: `SEARCH status_history USING INDEX idx_status_history_pc_changed_id (pc_id=? AND changed_at>? AND changed_at<?)`
  - 判定: 想定どおりインデックス利用

## 運用ルール

- クエリ変更時は、このページと `docs/backend/db/er.md` を同時更新する。
- インデックス追加前に「対象クエリ」「期待効果」「副作用（更新コスト増）」を明記する。
- 採用判断は `EXPLAIN QUERY PLAN` で実クエリを確認して行う。
