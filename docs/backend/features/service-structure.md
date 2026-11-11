# Service Structure

## 目的

API → service → repository の構成で、HTTPの入出力と操作の手順を分離し、コードを追いやすくする。

## 変更内容

- 2026-11-12: usecase層を廃止し、受付処理を既存のserviceへ統合した。受付用の新しい層は設けない。
- `pc_service.request_wol()`: PC存在確認、WOLジョブ作成、実行予約、ジョブイベント通知。
- `pc_service.refresh_pc_status_and_publish()`: 同期の状態更新を別スレッドで実行し、PC状態イベントを通知。
- `pc_service.request_refresh_all_statuses()`: 全PC更新ジョブの重複判定、実行予約、通知。
- `shutdown_service.request_pc_shutdown()`: 停止設定の確認、PC単位のジョブ重複判定、実行予約、通知。
- トークン管理APIは `api_token_service` の一覧・発行・失効・削除を直接呼ぶ。引数を渡すだけの中継処理とその委譲テストは削除した。
- ジョブ受付とイベント通知の既存テストは `tests/services/test_pc_service.py` へ統合した。

## 責務分担

- `app/api/`: 入力モデル、HTTPレスポンス、業務例外からHTTP例外への変換。
- `app/services/`: 操作の手順、ジョブ受付、イベント通知、個別の実行処理。
- `app/repositories/`: SQLiteの読み書き。
- `app/models/`: API入出力のPydanticモデル。

## 運用時の注意点

- API契約、DBスキーマ、ジョブの重複判定、認証・レート制限は変更しない。
- 同期の `pc_service.refresh_pc_status()` は監視処理や停止後の確認でも利用する。イベント通知を伴う非同期の入口と分けて維持する。
- `pc_service` は停止可否を参照するため `shutdown_service` に依存する。停止後の状態確認での逆向き参照は既存どおり関数内で読み込み、モジュール読込時の循環参照を避ける。
- 実ネットワークの確認と配備は別途行う。リファクタリングのテストではWOL・停止命令を実機へ送らない。
