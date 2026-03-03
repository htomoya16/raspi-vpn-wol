# Runtime Feature

## 目的

- フロントエンドの実行環境（Vite/TypeScript）と開発時コマンドを明確化する。

## 変更内容

- React + Vite 構成でフロントエンドを実装。
- TypeScript 化を完了し、`tsconfig.json` と型定義を整備。
- `useMediaQuery` を使い、幅 `760px` を境にモバイル/PCレイアウトを切り替える。

## 運用時の注意点

- 開発時は `npm run dev`、型確認は `npm run typecheck` を利用する。
- Vite 開発サーバーでは `/api` をバックエンドへプロキシする想定。
- 変更時の最小確認は `npm run lint` / `npm run typecheck` / `npm run test` を順に実行する。
