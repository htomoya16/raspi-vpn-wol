# Testing Feature

## 目的

- フロントエンドの回帰を、UI操作とロジックの両面で自動検知できる状態にする。

## 変更内容

- Vitest + Testing Library を導入。
- `src/**/*.test.ts(x)` の同居型でテストを配置。
- `npm run test` を追加し、`frontend-ci.yml` に組み込んだ。
- API/Hook/Component/Utils それぞれに回帰テストを追加。
- 稼働時間UIの回帰として `UptimePanel` のAPI連携・週移動・エラー表示・モック切替をテスト対象に追加。

## 運用時の注意点

- 仕様変更時は実装と同じPRでテスト更新を行う。
- 詳細なテスト一覧は `docs/frontend/tests/README.md` を参照する。
