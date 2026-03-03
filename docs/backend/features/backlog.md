# Backend Backlog

## 現時点で足りないもの

- トークン管理画面の権限制御UX改善（role選択、admin専用表示）
- APIレート制限
- 自動テスト拡充（status/wol成功系、service単体、CI連携）
- エラーレスポンス形式の共通化

## 補足

- 現在は VPN 内アクセス前提だが、副作用API（WOL送信）があるため認証とレート制限は優先度が高い。
- 端末別 Bearer トークン認証（backend）は実装済み。`/api/admin/*` は admin 専用化済み。
- admin 全損時の復旧は `python scripts/create_api_token.py --role admin --name break-glass-admin` を利用する。
- 監査ログには `api_token_id` / `actor_label` が記録される。
- DBバックアップ/リストア手順は `docs/deploy/db/README.md` を正として運用する。
- `pcs` のCRUDは揃ったため、今後は `Error` 形式統一やSSEイベント種別の整理を優先すると学習効果が高い。
