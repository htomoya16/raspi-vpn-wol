# Backend Notes

## 目的

- FastAPI バックエンドの実装を機能単位で参照できるように整理する。
- API・サービス・DBの責務分離と運用前提を明文化する。

## 変更内容

- 2026-02-21: API/DBを vNext 契約ベースへ再設計（`pcs`/`jobs`/`events` を追加）。
- 2026-02-11: `docs/backend` を機能別ドキュメント構成へ再編。
- 2026-02-11: 初期機能ページを追加し、以後 vNext 構成へ更新。
- 2026-02-11: `app/models` を追加し、API入出力モデル定義を `api` から分離。
- 2026-02-11: logs保持ポリシーを実装（30日超削除 + 最新7000件上限）。
- 2026-02-11: `app/types.py` を追加し、repository/service の戻り値を `TypedDict` で型付け。
- 2026-02-12: `pytest + TestClient` による API最小テストを追加。
- 2026-02-20: OpenAPI 契約の横断ドキュメントを `api/openapi.md` として追加。

## 現状の機能

- `GET /api/health`: 稼働確認（`{"status":"ok"}`）。
- `GET /api/pcs`: PC一覧取得（検索/フィルタ/カーソル対応）。
- `POST /api/pcs`: PC登録。
- `GET /api/pcs/{pc_id}`: PC詳細取得。
- `PATCH /api/pcs/{pc_id}`: PC部分更新。
- `DELETE /api/pcs/{pc_id}`: PC削除。
- `POST /api/pcs/{pc_id}/wol`: WOL送信ジョブ受付（202）。
- `POST /api/pcs/{pc_id}/status/refresh`: 単体ステータス更新。
- `POST /api/pcs/status/refresh`: 全PCステータス更新ジョブ受付（202）。
- `GET /api/logs`: 操作ログ取得（`pc_id`/`action`/`ok`/`since`/`until`/`cursor`）。
- `GET /api/jobs/{job_id}`: 非同期ジョブ状態取得。
- `GET /api/events`: SSEイベントストリーム。
- `pytest` で最小回帰テストを実行可能（health/pcs/logs/jobs）。

## 運用時の注意点

- 実装変更時は、該当機能ページを同時更新する。
- API仕様の確認は `docs/backend/api/openapi.md` を参照する。
- API I/F変更時は、入力項目・バリデーション・代表レスポンスを明記する。
- DBスキーマ変更時は、初期化手順（`app.db` 再作成）を合わせて追記する。

## 未実装 / 改善候補

- 認証/認可（簡易トークンやLAN/VPN制限の強化）。
- レート制限（WOL/APIの連打対策）。
- job ワーカー分離（現在はアプリ内で非同期実行）。
- status 判定方式の追加（ARP、複数ポート、複合判定）。
- 自動テスト（unit/integration）と CI 整備。
- DBバックアップ・リストア手順の明文化。

## API 契約ドキュメント

- `docs/backend/api/openapi.md`

## DB 設計ドキュメント

- `docs/backend/db/er.md`（DBスキーマの正）

## 機能別ドキュメント

- `docs/backend/features/pcs.md`
- `docs/backend/features/wol.md`
- `docs/backend/features/status.md`
- `docs/backend/features/logs.md`
- `docs/backend/features/runtime.md`
- `docs/backend/features/types-and-models.md`
- `docs/backend/features/backlog.md`
- `docs/backend/features/testing.md`

## テスト仕様ドキュメント

- `docs/backend/tests/README.md`
- `docs/backend/tests/conftest.md`
- `docs/backend/tests/api-minimum.md`
- `docs/backend/tests/api-comprehensive.md`
- `docs/backend/tests/services-unit.md`
