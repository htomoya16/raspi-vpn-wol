# API Client Feature

## 目的

- フロントの通信処理を `src/api` に集約し、UI実装から分離する。

## 変更内容

- `src/api/http.ts` に共通 `request` と `ApiError` を実装。
- `src/api/http.ts` に `requestCached` を追加し、TTL付き in-memory キャッシュを利用可能にした。
- `src/api/cache-policy.ts` にキー接頭辞・TTL・キー生成関数を集約した。
- `src/api/query.ts` にクエリ文字列生成を共通化し、APIモジュール間のキー不整合を防ぐ。
- キャッシュ詳細は `docs/frontend/features/cache.md` で管理する。
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
