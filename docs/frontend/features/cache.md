# Cache Feature

## 目的

- API呼び出し回数を減らし、体感表示速度を改善する。
- ロード中のレイアウト崩れを抑えつつ、最新データへの追従性を維持する。

## 変更内容

- フロントキャッシュは「メモリキャッシュ + 再検証」で設計する。
- 基本方針:
  - `GET` のみキャッシュ対象。
  - `POST/PATCH/DELETE` はキャッシュしない。
  - 変異系成功時は関連キーを即 invalidate する。
  - 画面は stale-while-revalidate（先にキャッシュ表示し、裏で再取得）を採用する。

### クエリキー設計（設計値）

- `pcs:list:q={q}:status={status}:limit={limit}:cursor={cursor}`
- `logs:list:limit={limit}:cursor={cursor}:pc_id={pc_id}:action={action}`
- `uptime:summary:pc={pc_id}:bucket={bucket}:from={from}:to={to}:tz={tz}`
- `uptime:weekly:pc={pc_id}:week_start={week_start}:tz={tz}`

### TTL設計（設計値）

- PC一覧: `30s`
- 稼働集計（summary）: `120s`
- 稼働タイムライン（weekly）: `120s`
- ログ: `10s`
- ジョブ: `5s`

### 無効化ルール（設計値）

- PC作成/更新/削除後:
  - `pcs:list:*`
  - `uptime:summary:pc={pc_id}:*`（削除は対象ID）
  - `uptime:weekly:pc={pc_id}:*`
  - `logs:list:*`
- WOL送信後:
  - `pcs:list:*`
  - `uptime:summary:pc={pc_id}:*`
  - `uptime:weekly:pc={pc_id}:*`
  - `logs:list:*`
- SSEイベント受信時:
  - `pc_status`: 該当PC uptimeキー + `pcs:list:*`
  - `job` 完了: `pcs:list:*`, `logs:list:*`, 関連 uptime キー

### フロント実装ステップ（次タスク）

1. `src/api/cache.ts` を追加して `get/set/invalidate/invalidateByPrefix` を実装する。
2. `src/api/http.ts` に `requestCached`（キー + TTL + revalidate）を追加する。
3. `usePcData` / `useLogsData` / `useUptimePanelState` から `requestCached` を利用する。
4. 変異系API成功時に `invalidate` を呼び、古い表示を残さないようにする。
5. テストを追加する（ヒット/期限切れ/無効化/並列リクエスト重複抑止）。

## 運用時の注意点

- キャッシュはメモリのみで、ページリロード時は消える設計にする（学習・デバッグを簡単にするため）。
- ロード表示は既存データを維持したまま、オーバーレイ `・・・` を重ねる。
- モバイルのスワイプ画面では、前回データを残しつつ再検証することで視覚的なチラつきを抑える。
