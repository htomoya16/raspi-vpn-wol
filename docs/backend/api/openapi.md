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

### `GET /api/pcs/{pc_id}/uptime/daily`

- operationId: `getPcDailyUptime`
- summary: PCの日次オンライン集計（グラフ表示向け）
- query: `from`, `to`, `tz`（任意, default: `Asia/Tokyo`）
- responses: `200`, `400`, `404`, `422`
- note: `from/to` は `YYYY-MM-DD`
- note: 取得期間は最大366日
- note: 集計では `online` のみをオンライン時間として扱い、`offline/unknown/booting/unreachable` はオフライン扱い

### `GET /api/pcs/{pc_id}/uptime/weekly`

- operationId: `getPcWeeklyTimeline`
- summary: 週タイムライン（1日ごとのオンライン区間）取得（カレンダー表示向け）
- query: `week_start`, `tz`（任意, default: `Asia/Tokyo`）
- responses: `200`, `400`, `404`, `422`
- note: `week_start` は週の開始日（`YYYY-MM-DD`）
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
- `PcDailyUptimeResponse`: 日次オンライン秒数一覧（グラフ向け）
- `PcWeeklyTimelineResponse`: 週タイムライン（1日ごとのオンライン区間）
- `Error`: 共通エラー（`code`, `message`, `details`）

## 追加スキーマ（uptime）

### `PcDailyUptimeResponse`

```json
{
  "pc_id": "pc-main",
  "from": "2026-02-01",
  "to": "2026-02-07",
  "tz": "Asia/Tokyo",
  "items": [
    {
      "date": "2026-02-01",
      "online_seconds": 28800,
      "online_ratio": 0.3333
    }
  ]
}
```

### `PcWeeklyTimelineResponse`

```json
{
  "pc_id": "pc-main",
  "week_start": "2026-02-23",
  "week_end": "2026-03-01",
  "tz": "Asia/Tokyo",
  "days": [
    {
      "date": "2026-02-24",
      "online_seconds": 39600,
      "intervals": [
        {
          "start": "04:00",
          "end": "08:00",
          "duration_seconds": 14400
        },
        {
          "start": "16:00",
          "end": "23:00",
          "duration_seconds": 25200
        }
      ]
    }
  ]
}
```
