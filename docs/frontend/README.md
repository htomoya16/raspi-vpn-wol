# Frontend Notes

## 目的

- React + Vite フロントエンドの仕様を、機能単位で参照できるように整理する。
- 実装変更時に「どのドキュメントを更新するか」を明確にする。

## 変更内容

- 2026-03-02: `App` のBearer検証処理を `useTokenValidation` へ分離し、認証ロジックの責務を集約。
- 2026-03-02: `GET /api/auth/me` の定期再検証間隔を `5秒` から `60秒` に変更（初期表示/フォーカス復帰/再表示時の即時検証は維持）。
- 2026-03-02: SSE接続を EventSource 制約対応（`/api/events?token=...`）へ変更し、フロントAPIキャッシュに上限300件・60秒ごとの期限切れ掃除を追加。
- 2026-03-02: トークン発行エリアに平文トークンのコピーアイコンを追加し、発行成功メッセージをBearer保存欄ではなくトークン発行欄へ表示するよう変更。
- 2026-03-02: 使用中トークンが `401`（失効/無効）になった場合に自動ロックして `APIトークン` 画面へ戻す挙動を追加。設定ダイアログ見出しを「設定」に統一し、ヘッダー補助ラベルの視認性を改善。
- 2026-03-02: トークン未設定時の設定画面を `APIトークン` 初期表示に変更し、ヘッダーへ現在端末（トークン名/ロール）表示を追加。
- 2026-03-02: Bearer未設定時の画面ロックを追加（PC一覧/ログ/稼働時間を隠し、設定のみ表示）し、保護API呼び出しを送信前に遮断。
- 2026-03-02: 設定画面に APIトークン管理（一覧/発行/失効/Bearer保存）を追加。
- 2026-03-02: APIトークン画面を role 対応（`admin/device`）へ更新し、保存成功表示と発行済み一覧スクロールを追加。
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
