# Backend Notes

## 目的

- FastAPI バックエンドの実装を機能単位で参照できるように整理する。
- API・サービス・DBの責務分離と運用前提を明文化する。

## 変更内容

- 2026-02-11: `docs/backend` を機能別ドキュメント構成へ再編。
- 2026-02-11: `targets` `wol` `status` `logs` `runtime` の機能ページを追加。
- 2026-02-11: `status` を ping ベース実装へ更新（`online/offline` 判定）。
- 2026-02-11: `DELETE /api/targets/{id}` を追加（存在しないIDは404）。
- 2026-02-11: `status_method/status_port` を追加し、status を TCP疎通対応。
- 2026-02-11: `app/models` を追加し、API入出力モデル定義を `api` から分離。
- 2026-02-11: logs保持ポリシーを実装（30日超削除 + 最新7000件上限）。
- 2026-02-11: `app/types.py` を追加し、repository/service の戻り値を `TypedDict` で型付け。
- 2026-02-12: `pytest + TestClient` による API最小テストを追加。

## 現状の機能

- `GET /api/health`: 稼働確認（`{"status":"ok"}`）。
- `GET /api/targets`: ターゲット一覧取得。
- `POST /api/targets`: ターゲット作成/更新（upsert）。
- `DELETE /api/targets/{id}`: ターゲット削除。
- `POST /api/wol`: ターゲットID指定で WOL マジックパケット送信。
- `GET /api/status?target=<id>`: `tcp` または `ping` で状態判定。
- `GET /api/logs?limit=<n>`: 操作ログ取得（1..200）。
- `pytest` で最小回帰テストを実行可能（health/targets/status/wol/logs）。

## 運用時の注意点

- 実装変更時は、該当機能ページを同時更新する。
- API I/F変更時は、入力項目・バリデーション・代表レスポンスを明記する。
- DBスキーマ変更時は、既存DB向けマイグレーション有無を追記する。

## 未実装 / 改善候補

- 認証/認可（簡易トークンやLAN/VPN制限の強化）。
- レート制限（WOL/APIの連打対策）。
- `PUT/PATCH /api/targets/{id}` の分離（現在は `POST` upsert のみ）。
- status 判定方式の追加（ARP、複数ポート、複合判定）。
- 自動テスト（unit/integration）と CI 整備。
- DBバックアップ・リストア手順の明文化。

## 機能別ドキュメント

- `docs/backend/features/targets.md`
- `docs/backend/features/wol.md`
- `docs/backend/features/status.md`
- `docs/backend/features/logs.md`
- `docs/backend/features/runtime.md`
- `docs/backend/features/types-and-models.md`
- `docs/backend/features/backlog.md`
- `docs/backend/features/testing.md`
