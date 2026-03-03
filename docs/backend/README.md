# Backend Notes

## 目的

- FastAPI バックエンドの実装を機能単位で参照できるように整理する。
- API・サービス・DBの責務分離と運用前提を明文化する。

## 変更内容

- 2026-03-03: ログ保持上限を 200,000 件へ拡張し、`jobs` にも保持ポリシー（30日 + 50,000件）を追加。
- 2026-03-02: SSE認証を EventSource 対応（`/api/events?token=...`）にし、`logs/jobs` の `Cache-Control: no-store` を明示。APIメモリキャッシュに上限/期限切れ掃除を追加。
- 2026-03-02: `/api/admin/*` を admin 専用化し、CLI復旧経路と監査ログ主体記録を追加。
- 2026-03-02: 端末別 Bearer トークン認証を実装（`api_tokens` / 管理 API / APIテスト）。
- 2026-02-27: キャッシュ方針を反映（DB集計 + APIメモリ + HTTP Cache-Control）。
- 2026-02-27: uptime weekly API の週開始日を「日曜始まり」に統一。
- 2026-03-01: `pcs.ip_address` を必須化（API入力 + DB `NOT NULL`）。
- 2026-02-21: API/DBを vNext 契約ベースへ再設計（`pcs`/`jobs`/`events` を追加）。
- 2026-02-11: `docs/backend` を機能別ドキュメント構成へ再編。
- 2026-02-11: 初期機能ページを追加し、以後 vNext 構成へ更新。
- 2026-02-11: `app/models` を追加し、API入出力モデル定義を `api` から分離。
- 2026-02-11: logs保持ポリシーを実装（30日超削除 + 件数上限）。
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
- `GET /api/pcs/{pc_id}/uptime/summary`: 稼働集計（`day/week/month/year`）。
- `GET /api/pcs/{pc_id}/uptime/weekly`: 週タイムライン取得（`week_start` は日曜始まり）。
- `GET /api/logs`: 操作ログ取得（`pc_id`/`action`/`ok`/`since`/`until`/`cursor`）。
- `DELETE /api/logs`: 操作ログ全削除。
- `GET /api/jobs/{job_id}`: 非同期ジョブ状態取得。
- `GET /api/events`: SSEイベントストリーム。
- `GET /api/admin/tokens`: APIトークン一覧取得。
- `POST /api/admin/tokens`: APIトークン発行（平文は1回返却）。
- `POST /api/admin/tokens/{token_id}/revoke`: APIトークン失効。
- `python scripts/create_api_token.py`: break-glass 用トークン発行（CLI）。
- `pytest` で最小回帰テストを実行可能（health/pcs/logs/jobs）。
- `python scripts/seed_dev_data.py` で開発用シードデータ（`pcs/status_history/uptime_daily_summary/jobs/logs`）を再投入可能。

## 運用時の注意点

- 実装変更時は、該当機能ページを同時更新する。
- API仕様の確認は `docs/backend/api/openapi.md` を参照する。
- API I/F変更時は、入力項目・バリデーション・代表レスポンスを明記する。
- DBスキーマ変更時は、Alembicリビジョン追加と適用手順（`alembic upgrade head`）を合わせて追記する。

## 未実装 / 改善候補

- トークン管理画面の権限制御UX改善（role選択、admin専用表示）。
- レート制限（WOL/APIの連打対策）。
- job ワーカー分離（現在はアプリ内で非同期実行）。
- status 判定方式の追加（ARP、複数ポート、複合判定）。
- 自動テスト（unit/integration）と CI 整備。

## API 契約ドキュメント

- `docs/backend/api/openapi.md`

## DB 設計ドキュメント

- `docs/backend/db/README.md`（DBドキュメント入口）
- `docs/backend/db/er.md`（DBスキーマの正）
- `docs/backend/db/uptime-tables.md`（uptime機能向けDDL案）
- `docs/backend/db/indexes.md`（実クエリとインデックス対応）

## 機能別ドキュメント

- `docs/backend/features/pcs.md`
- `docs/backend/features/wol.md`
- `docs/backend/features/status.md`
- `docs/backend/features/cache.md`
- `docs/backend/features/logs.md`
- `docs/backend/features/runtime.md`
- `docs/backend/features/auth-device-tokens.md`
- `docs/backend/features/types-and-models.md`
- `docs/backend/features/backlog.md`
- `docs/backend/features/testing.md`

## テスト仕様ドキュメント

- `docs/backend/tests/README.md`
- `docs/backend/tests/conftest.md`
- `docs/backend/tests/api-minimum.md`
- `docs/backend/tests/api-comprehensive.md`
- `docs/backend/tests/services-unit.md`
- `docs/backend/tests/db-init.md`
- `docs/backend/tests/runtime-lifespan.md`
