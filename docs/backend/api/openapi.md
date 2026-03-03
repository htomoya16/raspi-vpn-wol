# OpenAPI Contract Notes (vNext)

## 認証（vNext）

- 方式: `Authorization: Bearer <token>`
- 適用範囲: `/api/health` を除く `/api/*`
- 例外: `GET /api/events` は EventSource 制約のため `?token=<bearer>` も受け付ける
- 共通エラー:
  - `401`（未指定 / 不正形式 / 無効トークン / 失効 / 期限切れ）
  - レスポンス例: `{"detail":"invalid bearer token"}`
- note: 有効トークンが 0 件の間はブートストラップ目的で一時的に認証をバイパスする。
- 認可（現行）:
  - `/api/pcs` などの業務APIは `admin` / `device` の両方許可。
  - `/api/admin/*` は `admin` role のみ許可し、`device` role には `403` を返す。

## レート制限（v1）

- 方式: バックエンド in-memory（トークン単位）
- 超過時:
  - `429 {"detail":"too many requests"}`
  - `Retry-After: <seconds>`
- ルール:
  - `POST /api/pcs/{pc_id}/wol`: `3回/60秒`
  - `POST /api/pcs/{pc_id}/status/refresh`: `6回/60秒`
  - `POST /api/pcs/status/refresh`: `1回/30秒`
  - `POST|DELETE /api/admin/*`: `10回/600秒`

## エンドポイント

### `GET /api/health`

- operationId: `getHealth`
- summary: API稼働状態を確認
- responses: `200`
- note: 認証不要（疎通確認のため開放）

### `GET /api/auth/me`

- operationId: `getCurrentActor`
- summary: 現在利用中のBearerトークン情報
- responses: `200`, `401`

### `GET /api/admin/tokens`

- operationId: `listApiTokens`
- summary: APIトークン一覧取得
- responses: `200`, `401`, `403`
- note: 管理画面向け。トークン平文は返さない。

### `POST /api/admin/tokens`

- operationId: `createApiToken`
- summary: APIトークン発行
- requestBody: `ApiTokenCreateRequest`
- responses: `201`, `400`, `401`, `403`, `429`, `422`
- note: 平文トークンは作成時レスポンスで1回のみ返す。

### `POST /api/admin/tokens/{token_id}/revoke`

- operationId: `revokeApiToken`
- summary: APIトークン失効
- responses: `200`, `400`, `401`, `403`, `404`, `429`
- note: 物理削除ではなく `revoked_at` を設定する。
- note: 最後の有効 `admin` トークンは失効できない（`400`）。

### `DELETE /api/admin/tokens/{token_id}`

- operationId: `deleteApiToken`
- summary: APIトークン削除
- responses: `200`, `400`, `401`, `403`, `404`, `429`
- note: `revoked_at` が設定された失効済みトークンのみ削除可能。
- note: 未失効トークンを削除しようとした場合は `400`。

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
- note: `ip` は必須（IPv4）

### `GET /api/pcs/{pc_id}`

- operationId: `getPc`
- summary: PC詳細取得
- responses: `200`, `400`, `404`

### `PATCH /api/pcs/{pc_id}`

- operationId: `updatePc`
- summary: PC部分更新
- requestBody: `PcUpdate`
- responses: `200`, `400`, `409`, `404`, `422`
- note: 更新後の `mac` が他PCと重複する場合は `409` を返す
- note: `409` の `detail` 例: `既に存在しています（MAC: AA:BB:CC:DD:EE:FF）`
- note: `ip` を更新する場合は `null` 不可（IPv4文字列のみ）

### `DELETE /api/pcs/{pc_id}`

- operationId: `deletePc`
- summary: PC削除
- responses: `204`, `400`, `404`

### `POST /api/pcs/{pc_id}/wol`

- operationId: `sendWol`
- summary: WOL送信（非同期）
- requestBody: `WolRequest`（任意）
- responses: `202`, `400`, `404`, `429`, `422`
- note: 送信後は `booting` へ更新し、バックエンドで3秒間隔の起動確認（最大20回 / 最大60秒）を行う
- note: WOL送信自体が失敗した場合、PC状態は `unreachable` に更新され、ジョブ状態は `failed` で終了する
- note: 起動確認で `unknown` / `unreachable` が返った場合は再試行せず、その状態でジョブを `failed` 終了する
- note: 起動確認で `online` に到達しない場合（`offline/unknown/unreachable`）はジョブ状態を `failed` として終了する

### `POST /api/pcs/{pc_id}/status/refresh`

- operationId: `refreshPcStatus`
- summary: 単体ステータス更新
- responses: `200`, `400`, `404`, `429`
- note: 既に `unreachable` のPCは、判定結果が `offline` でも `unreachable` を維持する

### `POST /api/pcs/status/refresh`

- operationId: `refreshAllStatuses`
- summary: 全PCステータス更新（非同期）
- responses: `202`, `429`
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
- note: 現行フロントのグラフ表示は `day`(1週間) / `month`(PC:12か月, スマホ:6か月) / `year`(5年) を利用

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
- responses: `200`, `400`, `422`
- cache-control: `no-store`
- note: `since` / `until` はタイムゾーン付きISO8601日時（例: `2026-03-01T00:00:00+09:00`）
- note: `since` / `until` はサーバー側でUTCに正規化して検索する

### `DELETE /api/logs`

- operationId: `clearLogs`
- summary: 操作ログ全削除
- responses: `200`

### `GET /api/jobs/{job_id}`

- operationId: `getJob`
- summary: ジョブ状態取得
- responses: `200`, `400`, `404`
- cache-control: `no-store`

### `GET /api/events`

- operationId: `streamEvents`
- summary: SSEイベントストリーム
- responses: `200` (`text/event-stream`)
- query: `token`（任意。EventSource利用時のBearerトークン）

## 主要スキーマ

- `PcStatus`: `online`, `offline`, `unknown`, `booting`, `unreachable`
- `Pc`: PC基本情報 + `status` + `timestamps`
- `PcCreate` / `PcUpdate`: 登録/更新入力
- `WolRequest`: `broadcast`, `port`, `repeat`
- `JobAccepted`, `Job`, `JobState`: 非同期処理
- `LogEntry`, `LogListResponse`, `LogClearResponse`: 監査ログ
  - `LogEntry.job_id` はジョブ由来ログの関連ID（null可）
  - `LogEntry.api_token_id` は実行主体トークンID（null可）
  - `LogEntry.actor_label` は実行主体ラベル（トークン名, null可）
  - `LogEntry.event_kind` はログ分類（`normal` / `periodic_status` など）
- `PcUptimeSummaryResponse`: オンライン集計一覧（日/週/月/年グラフ向け）
- `PcWeeklyTimelineResponse`: 週タイムライン（1日ごとのオンライン区間）
- `ApiToken` / `ApiTokenListResponse`: 管理画面向けトークン一覧（平文トークンは含めない）
- `ApiToken.role`: `admin|device`
- `ApiTokenCreateRequest` / `ApiTokenCreateResponse`: トークン発行入力（`role` 任意）と1回表示の平文トークン返却
- `ApiTokenDeleteResponse`: 物理削除結果（`deleted_token_id`, `deleted`）
- `ApiActorMeResponse`: 現在利用中トークン（`token_id`, `token_name`, `token_role`）
- `Error`: 基本は FastAPI 既定エラー形式（`detail`）
