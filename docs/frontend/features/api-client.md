# API Client Feature

## 目的

- フロントの通信処理を `src/api` に集約し、UI実装から分離する。

## 変更内容

- `src/api/http.ts` に共通 `request` と `ApiError` を実装。
- APIモジュールを機能別に分割:
  - `pcs.ts`
  - `logs.ts`
  - `jobs.ts`
  - `events.ts`
  - `health.ts`
- `formatApiError` で HTTPステータスごとの表示文言を統一。

## 運用時の注意点

- API I/F 変更時は `src/api/*` と UI/Hook 呼び出し側を同時更新する。
- バックエンド仕様との整合確認は `docs/backend/api/openapi.md` を正とする。
