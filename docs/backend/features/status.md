# Status Feature

## 目的

- ターゲットの起動状態を問い合わせるAPIの入口を提供する。
- 後続で疎通判定実装（ping等）へ拡張しやすい形を維持する。

## 変更内容

- `GET /api/status?target=<id>` を提供。
- 現状実装はプレースホルダで、`status="unknown"` を返す。
- 呼び出し時は `logs` に `action=status` と結果メッセージを記録する。

## 運用時の注意点

- 現段階の `status` は実測値ではないため、運用判断には使わない。
- 実測実装へ移行時は、判定方式（ping/ARP/ポート疎通）とタイムアウトを明記する。
- 返却値の語彙（`online/offline/unknown` など）はフロントと同時に更新する。
