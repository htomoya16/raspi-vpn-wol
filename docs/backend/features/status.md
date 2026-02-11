# Status Feature

## 目的

- ターゲットの起動状態を問い合わせるAPIの入口を提供する。
- 後続で疎通判定実装（ping等）へ拡張しやすい形を維持する。

## 変更内容

- `GET /api/status?target=<id>` を提供。
- `target`（ID）から `targets.ip_address` を参照し、`ping` で状態判定する。
- 返却値:
  - `online`: ping成功
  - `offline`: ping失敗
- 呼び出し時は `logs` に `action=status` と結果メッセージを記録する。
- エラー時（HTTP 400）:
  - 対象ID未登録
  - `ip_address` 未設定 / 不正
  - `ping` コマンド未導入

## 運用時の注意点

- 現在の判定方式は `ping -c 1 -W 1`（IPv4）であり、ICMPを遮断する端末は `offline` になる。
- `status` 利用環境には `ping` コマンドを導入しておく。
- 返却値の語彙（`online/offline/unknown` など）はフロントと同時に更新する。
