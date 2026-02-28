# Logs Feature

## 目的

- API操作結果を時系列で確認できるようにし、障害調査を容易にする。
- WOL送信や設定変更の監査ログとして最小限の履歴を保持する。

## 変更内容

- `GET /api/logs` を提供（`pc_id` `action` `ok` `since` `until` `limit` `cursor`）。
- `DELETE /api/logs` を提供（全ログ削除、削除件数を返却）。
- `logs` テーブルの記録項目:
  - `id`, `pc_id`, `job_id`, `action`, `event_kind`, `ok`, `status`, `message`, `details_json`, `created_at`
- 主な記録トリガー:
  - `pc_upsert`
  - `pc_delete`
  - `wol`（成功/失敗）
  - `status`
- 補足:
  - `action=status` の中でも `event_kind=periodic_status` で定期ステータス確認を識別する。
  - 旧方式の `action=seed_status` は廃止し、DBマイグレーションで `action=status` に正規化する。
- 取得順序は `id DESC`（新しい順）、ページングは `cursor`（`id < cursor`）で実施。
- 保持ポリシー:
  - `created_at` が30日より古いログを削除
  - 最新7000件を超える分を削除

## 運用時の注意点

- `message` は障害追跡に必要な最小情報のみ記録し、個人情報は入れない。
- ログ削除は書き込み時に自動実行される（定期ジョブは未実装）。
- UIからのログ消去は不可逆操作のため、確認ダイアログ表示を必須とする。
- API障害時は `/api/logs` と SQLite直接参照の両方で整合性を確認する。
