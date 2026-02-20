# OpenAPI Contract Notes

## API 契約ドラフト

### `GET /api/health`

- summary: API 稼働状態を確認する
- description: アプリの生存確認用エンドポイント。成功時は固定レスポンスを返す。
- responses:
  - `200`: `{"status":"ok"}`

### `GET /api/status?target=<id>`

- summary: ターゲットの起動状態を取得する
- description: `target` の到達性を判定し、`status` は `online/offline` を返す。
- responses:
  - `200`: `StatusResponse`
  - `400`: 業務エラー（対象未登録、IP未設定、判定方式不正など）
  - `422`: リクエスト形式エラー（`target` 未指定、型不正）

### `POST /api/wol`

- summary: 指定ターゲットへ WOL を送信する
- description: `target` で指定した端末へ Magic Packet を送信し、結果を返す。
- responses:
  - `200`: `WolResponse`
  - `400`: 業務エラー（対象未登録、送信設定不正など）
  - `422`: リクエスト形式エラー（必須項目不足、型不正）

### `GET /api/targets`

- summary: ターゲット一覧を取得する
- description: 登録済みターゲット設定を返す。
- responses:
  - `200`: `TargetsListResponse`

### `POST /api/targets`

- summary: ターゲットを作成または更新する
- description: `id` をキーに upsert し、WOL/状態確認の設定を保存する。
- responses:
  - `200`: `TargetItemResponse`
  - `400`: 業務エラー（サービス層の検証エラー）
  - `422`: リクエスト形式エラー（必須不足、型不正、範囲外）

### `DELETE /api/targets/{target_id}`

- summary: ターゲットを削除する
- description: 指定した `target_id` の設定を削除する。
- responses:
  - `200`: `TargetDeleteResponse`
  - `400`: 業務エラー（ID不正）
  - `404`: 対象が存在しない

### `GET /api/logs?limit=<n>`

- summary: 操作ログを取得する
- description: 最新ログを `limit` 件返す。並び順は新しい順。
- responses:
  - `200`: `LogsResponse`
  - `422`: リクエスト形式エラー（`limit` 範囲外、型不正）
