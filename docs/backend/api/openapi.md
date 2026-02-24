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

### `POST /api/pcs/{pc_id}/status/refresh`

- operationId: `refreshPcStatus`
- summary: 単体ステータス更新
- responses: `200`, `400`, `404`

### `POST /api/pcs/status/refresh`

- operationId: `refreshAllStatuses`
- summary: 全PCステータス更新（非同期）
- responses: `202`
- note: `status_refresh_all` が `queued/running` の場合は新規作成せず既存ジョブIDを返す
- note: バックエンドでは同等の全体更新ジョブを60秒ごとに自動投入する

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
- `Error`: 共通エラー（`code`, `message`, `details`）
