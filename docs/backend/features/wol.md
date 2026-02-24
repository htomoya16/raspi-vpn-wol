# WOL Feature

## 目的

- 指定PCへ Magic Packet を送信し、PC起動をトリガーする。
- 送信結果をログへ記録し、失敗原因を追跡できるようにする。

## 変更内容

- `POST /api/pcs/{pc_id}/wol` で `pc_id` を受け取り、`pcs` 設定から送信する。
- 実行はジョブとして受け付け、`202` + `job_id` を返す。
- Magic Packet 仕様:
  - `0xFF` を 6バイト
  - MACアドレスを 16回連結
  - 合計 102バイトを UDP Broadcast で送信
- 送信IF制御:
  - `send_interface` を使用（未設定時は `eth0`）。
  - `wg*` は送信不可。
  - `broadcast_ip` 未指定時は IF の broadcast を自動取得。
- 検証:
  - `wol_port` 範囲チェック。
  - `ip_address` 設定時は IF のネットワーク内に属するか確認。
- リクエスト上書き:
  - `broadcast`, `port`, `repeat` を指定した場合は送信時に上書き。
- 起動待ちポーリング:
  - WOL送信後は `booting` に更新し、3秒間隔で起動確認を実行する。
  - 最大20回（約60秒）まで確認し、成功時は `online` に更新する。
  - タイムアウト時は、過去に到達実績があるPCは `offline`、未到達PCは `unknown` に更新する。
- ログ:
  - 成功: `status=sent`
  - 失敗: `status=failed`（理由を `message` に格納）

## 運用時の注意点

- WOLは同一L2/LANセグメント前提なので、VPN IF（`wg0`）には送らない。
- `ip_address` と `send_interface` の組み合わせが不整合だと送信前にエラーになる。
- `broadcast_ip` を明示した場合、IF自動算出より優先される。
