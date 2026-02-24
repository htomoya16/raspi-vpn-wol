# Status Feature

## 目的

- PCの起動状態を問い合わせるAPIの入口を提供する。
- 後続で疎通判定実装（ping等）へ拡張しやすい形を維持する。

## 変更内容

- `POST /api/pcs/{pc_id}/status/refresh` を提供。
- `pc_id` から `pcs.ip_address` を参照し、`status_method` に応じて判定する。
- 返却値:
  - `online`: 疎通成功
  - `offline`: 疎通失敗
  - `unreachable`: 判定処理自体が失敗
- 判定方式:
  - `tcp`: `status_port` への TCP connect（timeout 1秒）
  - `ping`: `ping -c 1 -W 1`
- PC作成時のデフォルトは `status_method=tcp`, `status_port=445`。
- 呼び出し時は `logs` に `action=status` と結果メッセージを記録する。
- エラー時（HTTP 400/404）:
  - 対象ID未登録
  - `ip_address` 未設定 / 不正
  - `status_method` / `status_port` 不正
  - `ping` コマンド未導入（`status_method=ping` 時）

## 稼働時間可視化向けの確定方針（次ブランチ実装予定）

- 稼働時間集計の状態解釈:
  - `online` のみオンライン時間として集計する。
  - `offline` / `unknown` / `booting` / `unreachable` はオフライン扱いとする。
- 状態履歴の保存ルール:
  - 監視ごとの全件保存は行わない。
  - 前回保存状態から変化した時のみ履歴を保存する。
- 保持期間:
  - 日次集計データは無期限保持とする。
  - 週タイムライン表示用の状態履歴は1年保持とする。

## 運用時の注意点

- `tcp` は対象ポートが閉じていると起動中でも `offline` になる。
- `ping` は ICMP遮断端末で `offline` になる。
- デフォルトは `status_method=tcp`, `status_port=445` なので、端末に合わせて変更する。
- `POST /api/pcs/status/refresh` で全PCの非同期更新も可能。
- バックエンド起動中は、60秒ごとに全PCステータス更新ジョブを自動投入する。
- 自動投入時は `status_refresh_all` の重複起動を抑止し、既存 `queued/running` ジョブを再利用する。
