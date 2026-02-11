# Targets Feature

## 目的

- WOL送信対象（ターゲット）の設定を管理する。
- `id` ベースで他機能（`/api/wol` `/api/status`）から参照できる状態を作る。

## 変更内容

- `GET /api/targets`: 登録済みターゲット一覧を返す。
- `POST /api/targets`: ターゲット設定を新規作成/更新（upsert）する。
- 保存項目: `id`, `name`, `mac_address`, `ip_address`, `broadcast_ip`, `send_interface`, `wol_port`。
- 入力検証:
  - `id` / `name` 必須。
  - `mac_address` は正規化して `AA:BB:CC:DD:EE:FF` 形式で保存。
  - `ip_address` / `broadcast_ip` は IPv4 のみ許可。
  - `wol_port` は `1..65535`。
  - `send_interface` は未指定時 `eth0`、`wg*` は拒否。

## 運用時の注意点

- `id` は論理キーなので、再登録時は同じ `id` で更新される。
- `send_interface` を変更すると WOL送信経路が変わるため、LAN到達性を再確認する。
- 設定変更は `logs` に `action=target_upsert` で記録される。
