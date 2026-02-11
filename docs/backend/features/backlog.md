# Backend Backlog

## 現時点で足りないもの

- 認証/認可
- APIレート制限
- 自動テスト（unit/integration）
- エラーレスポンス形式の共通化
- DBバックアップ/リストア手順
- スキーマ変更管理の明確化（手書き migration 継続か Alembic 導入か）

## 補足

- 現在は VPN 内アクセス前提だが、副作用API（WOL送信）があるため認証とレート制限は優先度が高い。
- `POST /api/targets` の upsert は動作上問題ないが、学習目的では `POST`（作成）と `PUT/PATCH`（更新）を分けると設計比較がしやすい。
