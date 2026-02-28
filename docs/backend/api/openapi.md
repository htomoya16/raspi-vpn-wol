# OpenAPI Contract Notes (vNext)

## エンドポイント

### `GET /api/health`

- operationId: `getHealth`
- summary: API稼働状態を確認
- responses: `200`

### `GET /api/pcs`

- operationId: `listPcs`
- summary: PC一覧取得
- query: `q`, `status`, `tag`, `limit`, `cursor`
- responses: `200`

### `POST /api/pcs`

- operationId: `createPc`
- summary: PC登録
- requestBody: `PcCreate`
- responses: `201`, `400`, `409`, `422`
- note: `id` または `mac` が重複する場合は `409` を返す
- note: `409` の `detail` 例: `既に存在しています（MAC: AA:BB:CC:DD:EE:FF）`

### `GET /api/pcs/{pc_id}`

- operationId: `getPc`
- summary: PC詳細取得
- responses: `200`, `404`

### `PATCH /api/pcs/{pc_id}`

- operationId: `updatePc`
- summary: PC部分更新
- requestBody: `PcUpdate`
- responses: `200`, `400`, `409`, `404`, `422`
- note: 更新後の `mac` が他PCと重複する場合は `409` を返す
- note: `409` の `detail` 例: `既に存在しています（MAC: AA:BB:CC:DD:EE:FF）`

### `DELETE /api/pcs/{pc_id}`

- operationId: `deletePc`
- summary: PC削除
- responses: `204`, `404`

### `POST /api/pcs/{pc_id}/wol`

- operationId: `sendWol`
- summary: WOL送信（非同期）
- requestBody: `WolRequest`（任意）
- responses: `202`, `400`, `404`, `422`
- note: 送信後は `booting` へ更新し、バックエンドで3秒間隔の起動確認（最大20回）を行う
- note: WOL送信自体が失敗した場合、PC状態は `unreachable` に更新され、ジョブ状態は `failed` で終了する
- note: 起動確認で `unknown` / `unreachable` が返った場合は再試行せず、その状態でジョブを `failed` 終了する
- note: 起動確認で `online` に到達しない場合（`offline/unknown/unreachable`）はジョブ状態を `failed` として終了する

### `POST /api/pcs/{pc_id}/status/refresh`

- operationId: `refreshPcStatus`
- summary: 単体ステータス更新
- responses: `200`, `400`, `404`
- note: `ip_address` 未設定時は `unknown` を返す
- note: 既に `unreachable` のPCは、判定結果が `offline` でも `unreachable` を維持する

### `POST /api/pcs/status/refresh`

- operationId: `refreshAllStatuses`
- summary: 全PCステータス更新（非同期）
- responses: `202`
- note: `status_refresh_all` が `queued/running` の場合は新規作成せず既存ジョブIDを返す
- note: バックエンドでは同等の全体更新ジョブを60秒ごとに自動投入する

### `GET /api/pcs/{pc_id}/uptime/summary`

- operationId: `getPcUptimeSummary`
- summary: PCのオンライン集計取得（日/週/月/年グラフ向け）
- query: `from`, `to`, `bucket`, `tz`（任意, default: `bucket=day`, `tz=Asia/Tokyo`）
- responses: `200`, `400`, `404`, `422`
- note: `from/to` は `YYYY-MM-DD`
- note: `bucket` は `day|week|month|year`
- note: 集計では `online` のみをオンライン時間として扱い、`offline/unknown/booting/unreachable` はオフライン扱い
- note: 週/月/年の集計は日次集計テーブルを再集約して返す
- note: API契約上、`day` バケットは `from/to` 指定日をそのまま日次で返す（週開始曜日の制約はない）
- note: 現行フロントのグラフ表示は `day`(1週間) / `month`(12か月) / `year`(5年) を利用

### `GET /api/pcs/{pc_id}/uptime/weekly`

- operationId: `getPcWeeklyTimeline`
- summary: 週タイムライン（1日ごとのオンライン区間）取得（カレンダー表示向け）
- query: `week_start`, `tz`（任意, default: `Asia/Tokyo`）
- responses: `200`, `400`, `404`, `422`
- note: `week_start` は日曜始まりの週開始日（`YYYY-MM-DD`）
- note: `week_start` 省略時は `tz` 基準の当週日曜を使用
- note: 週タイムライン用の状態履歴は1年保持。保持範囲外の週指定は `400`
- note: 区間は1日内ローカル時刻で返却し、UI側でカレンダー表示へマッピングする

### `GET /api/logs`

- operationId: `listLogs`
- summary: 操作ログ取得
- query: `pc_id`, `action`, `ok`, `since`, `until`, `limit`, `cursor`
- responses: `200`, `422`

### `DELETE /api/logs`

- operationId: `clearLogs`
- summary: 操作ログ全削除
- responses: `200`

### `GET /api/jobs/{job_id}`

- operationId: `getJob`
- summary: ジョブ状態取得
- responses: `200`, `404`

### `GET /api/events`

- operationId: `streamEvents`
- summary: SSEイベントストリーム
- responses: `200` (`text/event-stream`)

## 主要スキーマ

- `PcStatus`: `online`, `offline`, `unknown`, `booting`, `unreachable`
- `Pc`: PC基本情報 + `status` + `timestamps`
- `PcCreate` / `PcUpdate`: 登録/更新入力
- `WolRequest`: `broadcast`, `port`, `repeat`
- `JobAccepted`, `Job`, `JobState`: 非同期処理
- `LogEntry`, `LogListResponse`, `LogClearResponse`: 監査ログ
  - `LogEntry.job_id` はジョブ由来ログの関連ID（null可）
- `PcUptimeSummaryResponse`: オンライン集計一覧（日/週/月/年グラフ向け）
- `PcWeeklyTimelineResponse`: 週タイムライン（1日ごとのオンライン区間）
- `Error`: 共通エラー（`code`, `message`, `details`）
