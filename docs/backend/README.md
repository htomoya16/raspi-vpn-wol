# Backend Notes

## 目的

- FastAPI バックエンドの実装を機能単位で参照できるように整理する。
- API・サービス・DBの責務分離と運用前提を明文化する。

## 変更内容

- 2026-02-11: `docs/backend` を機能別ドキュメント構成へ再編。
- 2026-02-11: `targets` `wol` `status` `logs` `runtime` の機能ページを追加。
- 2026-02-11: `status` を ping ベース実装へ更新（`online/offline` 判定）。
- 2026-02-11: `DELETE /api/targets/{id}` を追加（存在しないIDは404）。

## 運用時の注意点

- 実装変更時は、該当機能ページを同時更新する。
- API I/F変更時は、入力項目・バリデーション・代表レスポンスを明記する。
- DBスキーマ変更時は、既存DB向けマイグレーション有無を追記する。

## 機能別ドキュメント

- `docs/backend/features/targets.md`
- `docs/backend/features/wol.md`
- `docs/backend/features/status.md`
- `docs/backend/features/logs.md`
- `docs/backend/features/runtime.md`
