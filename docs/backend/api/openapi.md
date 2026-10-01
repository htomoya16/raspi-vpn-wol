# OpenAPI Contract Notes (vNext)

## 認証（vNext）

- 方式: `Authorization: Bearer <token>`
- 適用範囲: `/api/health` を除く `/api/*`
- 例外: `GET /api/events` は EventSource 制約のため `?token=<bearer>` も受け付ける
- 共通エラー:
  - `401`（未指定 / 不正形式 / 無効トークン / 失効 / 期限切れ）
  - レスポンス例: `{"detail":"invalid bearer token"}`
- note: 有効トークンが 0 件の間はブートストラップ目的で一時的に認証をバイパスする。
- 例外: シャットダウンとSSH設定APIはブートストラップ中も認証必須。
- 認可（現行）:
  - `/api/pcs` などの業務APIは `admin` / `device` の両方許可。
  - `/api/admin/*` は `admin` role のみ許可し、`device` role には `403` を返す。
  - `/api/pcs/{pc_id}/ssh` とその配下は認証済み `admin` のみ許可。

## レート制限（v1）

- 方式: バックエンド in-memory（トークン単位）
- 超過時:
  - `429 {"detail":"too many requests"}`
  - `Retry-After: <seconds>`
- ルール:
  - `POST /api/pcs/{pc_id}/wol`: `3回/60秒`
  - `POST /api/pcs/{pc_id}/shutdown`: `3回/60秒`
  - `PUT|POST /api/pcs/{pc_id}/ssh` とその配下: 合計 `20回/600秒`
  - `POST /api/pcs/{pc_id}/status/refresh`: `6回/60秒`
  - `POST /api/pcs/status/refresh`: `1回/30秒`
  - `POST|DELETE /api/admin/*`: `10回/600秒`

## エンドポイント

### `GET /api/health`

- operationId: `getHealth`
- summary: API稼働状態を確認
- responses: `200`
- note: 認証不要（疎通確認のため開放）
- response body: `{"status":"ok","version":"<app-version>","build":"<build-id>"}`（`build` は環境変数指定値、または git短縮SHA。git解決不可時は `local`）

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

### `POST /api/pcs/{pc_id}/shutdown`

- summary: 対象Windows PCへ通常の停止指示を送る（非同期、`admin/device` とも認証必須）。
- responses: `202` (`JobAccepted`), `401`, `404`, `409`, `429`
- note: 有効なSSH設定・鍵・現在のIPでの接続確認・オンライン状態が必要。未完了の同一PC停止ジョブがあれば既存IDを返す。
- note: 固定コマンド `shutdown /s /t 0` を使用。ジョブ結果は `pc_id`, `command_sent`, `offline_observed`, `message`。通信停止の観測は電源断の保証ではない。

### PC別SSH設定（`admin` 専用）

| Method / Path | 用途 | 入力 | 成功レスポンス |
|---|---|---|---|
| `GET /api/pcs/{pc_id}/ssh` | 設定取得 | — | `200 PcSshSettingsResponse` (`no-store`) |
| `PUT /api/pcs/{pc_id}/ssh` | 設定保存 | `PcSshSettingsUpdate` | `200 PcSshSettingsResponse` |
| `POST /api/pcs/{pc_id}/ssh/key` | 鍵生成・既存公開鍵取得 | — | `200 PcSshSettingsResponse` |
| `POST /api/pcs/{pc_id}/ssh/host-key/scan` | 未確認のホスト鍵候補取得 | — | `200 HostKeyCandidate` |
| `POST /api/pcs/{pc_id}/ssh/host-key` | 指紋を照合して登録 | `HostKeyConfirmation` | `200 PcSshSettingsResponse` |
| `POST /api/pcs/{pc_id}/ssh/test` | 停止命令なしの接続確認 | — | `200 PcSshSettingsResponse` |

- 共通エラー: `401`, `403`, `404`, `409`（設定不足・照合/接続失敗）, `503`（ファイル操作失敗）。変更操作は `429`、入力不正は `422`。
- `PcSshSettingsUpdate`: `username`（1〜64文字、英数字・`_ . -`、先頭は英数字か`_`）, `port`（整数1〜65535、既定22）, `enabled`（既定false）。IPはPC登録情報を参照する。
- `HostKeyCandidate`: `host_key`, `fingerprint`, `ip`, `revision`。取得だけでは信頼しない。
- `HostKeyConfirmation`: 候補の `host_key`, `ip`, `revision` と、PC側で確認した `fingerprint`。取得後の設定/IP変更は拒否する。
- `PcSshSettingsResponse`: `pc_id`, `ip`, `username`, `port`, `enabled`, `public_key`, `host_fingerprint`, `verified`, `verified_at`, `setup_script`, `fingerprint_command`。秘密鍵・保存パスは返さない。
- ユーザー名/ポート変更はホスト鍵と接続確認、IP変更は接続確認を解除する。有効/無効だけの変更は確認結果を保持する。
- 運用手順: [PCシャットダウン](../../deploy/runbook.md#pcシャットダウン)。

### `POST /api/pcs/{pc_id}/status/refresh`

- operationId: `refreshPcStatus`
- summary: 単体ステータス更新
- responses: `200`, `400`, `404`, `429`
- note: `offline` は2回連続失敗時に反映する（1回目失敗時は前回状態を維持）
- note: 既に `unreachable` のPCは、判定結果が `offline` でも `unreachable` を維持する

### `POST /api/pcs/status/refresh`

- operationId: `refreshAllStatuses`
- summary: 全PCステータス更新（非同期）
- responses: `202`, `429`
- note: `status_refresh_all` が `queued/running` の場合は新規作成せず既存ジョブIDを返す
- note: バックエンドでは同等の全体更新ジョブを60秒ごとに自動投入する
- note: 各PCの `offline` 反映は2回連続失敗時（1回目失敗時は前回状態維持）

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
- note: 週タイムライン用の状態履歴は5年保持。保持範囲外の週指定は `400`
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
- `Pc`: PC基本情報 + `status` + `timestamps` + `shutdown`（`configured`, `reason`）。SSHの準備状態と不可理由を返し、オンライン状態は `status` で別途判定する。
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
