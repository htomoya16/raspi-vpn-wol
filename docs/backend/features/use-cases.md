# Use Cases

## 目的

- API層からアプリケーション操作の流れを分離し、router の責務をHTTP境界に寄せる。
- 複数 service を組み合わせる処理を1か所にまとめ、テストしやすくする。

## 変更内容

- `backend/app/use_cases/` を追加した。
- WOL送信受付の流れを `app/use_cases/wol_use_case.py` に切り出した。
- `POST /api/pcs/{pc_id}/wol` の router は、入力を受け取り `wol_use_case.request_wol()` を呼び、HTTPレスポンスへ変換する役割に絞った。
- ステータス更新受付の流れを `app/use_cases/status_use_case.py` に切り出した。
- `POST /api/pcs/{pc_id}/status/refresh` の router は、単体ステータス更新 use case を呼び、HTTPレスポンスへ変換する役割に絞った。
- `POST /api/pcs/status/refresh` の router は、全PCステータス更新ジョブの受付 use case を呼び、HTTPレスポンスへ変換する役割に絞った。
- `request_wol()` は以下を担当する。
  - PC存在確認
  - WOLジョブpayload作成
  - ジョブ作成
  - バックグラウンド実行予約
  - SSE向けジョブイベント通知
- `status_use_case.refresh_pc_status()` は以下を担当する。
  - 単体PCのステータス更新
  - SSE向けPCステータスイベント通知
- `status_use_case.request_refresh_all_statuses()` は以下を担当する。
  - 全PCステータス更新ジョブの作成または既存ジョブ再利用
  - 新規ジョブ作成時のバックグラウンド実行予約
  - SSE向けジョブイベント通知

## 責務分担

- `app/api/`: HTTPの入口。Path/Query/Body、response model、HTTPステータス、HTTP例外変換を担当する。
- `app/use_cases/`: 1つのユーザー操作の流れを組み立てる。複数 service の呼び出し順序を担当する。
- `app/services/`: 個別の業務処理を担当する。
- `app/repositories/`: SQLiteの読み書きを担当する。
- `app/models/`: API入出力のPydanticモデルを担当する。

## 運用時の注意点

- すべての処理を無理に use case 化しない。
- 複数 service をまたぐ処理、ジョブやイベント通知を伴う処理から順に切り出す。
- 単純なCRUDは、router から service を直接呼ぶ現状のままでもよい。
- use case はHTTP固有の `HTTPException` を投げず、`ValueError` / `LookupError` などの業務例外を router 側でHTTPに変換する。
