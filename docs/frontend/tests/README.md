# Frontend Test Docs

## 目的

- フロントエンドのテスト構成と検証観点を明文化し、変更時の更新漏れを防ぐ。
- UI変更時に「どこを壊しやすいか」を先に確認できる状態にする。

## テスト配置方針

- 現在は **同居型**（`src/**/*.test.ts(x)`）を採用。
- 対象ファイルの近くにテストを置き、実装とテストを同時に追える構成にしている。

## 対象テスト

- API:
  - `frontend/src/api/http.test.ts`
- Hooks:
  - `frontend/src/hooks/useJobTracker.test.tsx`
- Components:
  - `frontend/src/components/LogsPanel.test.tsx`
  - `frontend/src/components/PcList.test.tsx`
  - `frontend/src/components/UptimePanel.test.tsx`
  - `frontend/src/components/pc-list/utils.test.ts`
- Utils:
  - `frontend/src/utils/datetime.test.ts`

## 何を担保しているか

- APIエラーハンドリングの整形（`formatApiError` / `request`）
- ジョブ追跡の成功・失敗・タイムアウト遷移
- PC一覧の詳細表示、編集バリデーション、削除確認ダイアログ
- ログ一覧の詳細展開、ログ削除確認フロー
- 稼働時間パネルのAPI連携、週移動、エラー表示、モック切替
- 日時変換（JST）と編集フォーム変換ロジック

## 実行方法

```bash
cd frontend
npm install
npm run test
```

## CI

- `.github/workflows/frontend-ci.yml` で `npm run test` を実行する。
