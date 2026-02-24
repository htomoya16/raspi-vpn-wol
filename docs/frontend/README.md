# Frontend Notes

## 目的

- React + Vite フロントエンドの仕様を、機能単位で参照できるように整理する。
- 実装変更時に「どのドキュメントを更新するか」を明確にする。

## 変更内容

- 2026-02-25: `docs/frontend/features/` へ機能別ドキュメントを分割。
- 2026-02-25: Vitest + Testing Library を導入し、CIで `npm run test` を実行する構成へ更新。
- 2026-02-23: UI/状態管理を分割し、TypeScript移行とレスポンシブ調整を継続反映。

## 運用時の注意点

- API仕様の正は `docs/backend/api/openapi.md` とする。
- UI仕様や挙動を変更した場合は、対応する `features` と `tests` ドキュメントを同時更新する。
- 配布対象は `frontend/dist/`。成果物は原則Git管理しない。

## 機能別ドキュメント

- `docs/frontend/features/runtime.md`
- `docs/frontend/features/ui.md`
- `docs/frontend/features/state-and-hooks.md`
- `docs/frontend/features/api-client.md`
- `docs/frontend/features/testing.md`
- `docs/frontend/features/deploy.md`

## テスト仕様ドキュメント

- `docs/frontend/tests/README.md`

## 学習ガイド

- `docs/frontend/learning-path.md`
