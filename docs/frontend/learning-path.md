# Frontend Learning Path

## 目的

- React/Vite 未経験でも、実務に近い手順で1つずつ実装できる状態を作る。

## 変更内容

- 2026-02-20: フロント初期化に合わせて、段階実装向けの学習手順へ更新。

## 運用時の注意点

- 各ステップは「目的」「実装」「確認結果」を残す。
- ステップ完了前に次の実装へ進まない。

## 実装ステップ

1. `Step 1: Vite + React を最小構成で起動する`
- 画面に固定テキストを表示し、`npm run dev` で表示確認する。

2. `Step 2: 画面レイアウトを分割する`
- `App` と `components` の責務を分ける。

3. `Step 3: APIクライアントを作る`
- `src/api/` に通信処理を集約し、UIから分離する。

4. `Step 4: PCs 一覧を表示する`
- `GET /api/pcs` の結果を表示する。

5. `Step 5: WOL送信と状態確認を追加する`
- `POST /api/pcs/{pc_id}/wol` と `POST /api/pcs/{pc_id}/status/refresh` を接続する。

6. `Step 6: ログ表示を追加する`
- `GET /api/logs` を表示し、件数切替を実装する。

7. `Step 7: フロント自動テストを追加する`
- Vitest + Testing Library を導入し、`api/hooks/components/utils` の回帰テストを追加する。
- `npm run test` をCIに組み込み、PR時に自動実行される状態にする。

## ステップごとの完了条件

1. 変更ファイルが小さく、役割が説明できる。
2. API通信時の成功/失敗を画面で確認できる。
3. 実装メモを `docs/frontend/README.md` に追記している。
