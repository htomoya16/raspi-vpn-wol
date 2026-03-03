# Testing Feature

## 目的

- フロントエンドの回帰を、UI操作とロジックの両面で自動検知できる状態にする。

## 変更内容

- Vitest + Testing Library を導入。
- `src/**/*.test.ts(x)` の同居型でテストを配置。
- `npm run test` を追加し、`frontend-ci.yml` に組み込んだ。
- API/Hook/Component/Utils それぞれに回帰テストを追加。
- 設定画面の回帰として `SettingsDialog.test.tsx` に APIトークン管理タブ（一覧取得/発行）テストを追加。
- `SettingsDialog.test.tsx` で Bearer保存成功表示・`403` 時の権限案内表示も検証する。
- APIクライアント回帰として `http.test.ts` に Bearer ヘッダー自動付与テストを追加。
- `http.test.ts` で `401/403` のエラー文言マッピングを検証する。
- `useTokenValidation.test.tsx` を追加し、Bearer検証の60秒再検証とフォーカス時の重複抑止を検証する。
- 稼働時間UIの回帰として `UptimePanel` のAPI連携・週移動・エラー表示・モック切替をテスト対象に追加。
- テストデータの重複定義を削減するため、共通factory (`src/test/factories.ts`) を導入。
- リファクタ後の回帰として `LogsPanel` / `PcList` / `UptimePanel` の既存シナリオを維持し、挙動互換を確認。

## 運用時の注意点

- 仕様変更時は実装と同じPRでテスト更新を行う。
- 詳細なテスト一覧は `docs/frontend/tests/README.md` を参照する。
