# PCs Feature

## 目的

- WOL送信対象PCの設定を管理する。
- `pc_id` ベースで `wol` / `status` / `logs` / `jobs` と連携できる状態を作る。

## 変更内容

- `GET /api/pcs`: 登録済みPC一覧を返す。
- `POST /api/pcs`: PC設定を新規作成する。
- `GET /api/pcs/{pc_id}`: 指定PCの詳細を返す。
- `PATCH /api/pcs/{pc_id}`: 指定PCを部分更新する。
- `DELETE /api/pcs/{pc_id}`: 指定PCを削除する。
- 一覧の `q/status/tag/cursor/limit` は repository のSQLで絞り込み・ページングする（Serviceでの全件後処理を廃止）。
- 保存項目: `id`, `name`, `mac_address`, `ip_address`, `broadcast_ip`, `send_interface`, `wol_port`, `status_method`, `status_port`。
- 入力検証:
  - `id` / `name` 必須。
  - `mac_address` は正規化して `AA:BB:CC:DD:EE:FF` 形式で保存。
  - `ip_address` は必須（IPv4 のみ許可）。
  - `broadcast_ip` は任意（指定時は IPv4 のみ許可）。
  - `wol_port` は `1..65535`。
  - `send_interface` は未指定時 `eth0`、`wg*` は拒否。
  - `status_method` は `tcp` / `ping`。
  - `status_port` は `1..65535`（未指定時 `445`）。

## 運用時の注意点

- `id` は論理キーなので重複登録時は `409` を返す。
- 削除対象が存在しない場合は `404` を返す。
- `send_interface` を変更すると WOL送信経路が変わるため、LAN到達性を再確認する。
- 設定変更/削除は `logs` に `action=pc_upsert` / `action=pc_delete` で記録される。
