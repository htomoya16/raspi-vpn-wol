# Frontend Notes

## 目的

- React + Vite フロントエンドの仕様を、機能単位で参照できるように整理する。
- 実装変更時に「どのドキュメントを更新するか」を明確にする。

## 変更内容

- 2026-03-01: フロント全体を責務分割リファクタ（`PcList` 分割、`usePcData` 分離、`LogsPanel` 分割、`Uptime` 取得フック分離、`logs-panel.css` 3分割、テストfactory共通化）。
- 2026-03-01: テーマ設定を `theme/` + `useThemeSettings` に整理し、設定画面のデフォルト色表示を外観連動の白黒単色へ調整。
- 2026-02-27: APIキャッシュ実装を追加（in-memory + requestCached + invalidate）。
- 2026-02-27: `UptimePanel` を `components/uptime/` 配下へ分割し、Hook/Utils/CSS責務を整理。
- 2026-02-27: 稼働時間UIを更新（`稼働タイムライン` 名称、モバイル1日表示、スワイプ操作、ロード表示安定化）。
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
- `docs/frontend/features/cache.md`
- `docs/frontend/features/testing.md`
- `docs/frontend/features/deploy.md`
- `docs/frontend/features/theme-system.md`

## テスト仕様ドキュメント

- `docs/frontend/tests/README.md`

## 学習ガイド

- `docs/frontend/learning-path.md`
