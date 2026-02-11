# Logs Feature

## 目的

- API操作結果を時系列で確認できるようにし、障害調査を容易にする。
- WOL送信や設定変更の監査ログとして最小限の履歴を保持する。

## 変更内容

- `GET /api/logs?limit=<n>` を提供（`1..200`, default `20`）。
- `logs` テーブルの記録項目:
  - `id`, `action`, `target`, `status`, `message`, `created_at`
- 主な記録トリガー:
  - `target_upsert`
  - `wol`（成功/失敗）
  - `status`
- 取得順序は `id DESC`（新しい順）。

## 運用時の注意点

- `message` は障害追跡に必要な最小情報のみ記録し、個人情報は入れない。
- 現状は保持上限/削除処理が未実装なので、将来的にローテーション方針を追加する。
- API障害時は `/api/logs` と SQLite直接参照の両方で整合性を確認する。
