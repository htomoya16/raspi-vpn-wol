# `services/*` Unit Summary

## 目的

- サービス層の分岐ロジックを、外部依存（socket/subprocess/db）をモックして高速・安定に検証する。
- APIテストでは見えにくい内部動作（状態遷移、イベント発行、エラーハンドリング）を担保する。

## 対象ファイル

- `backend/tests/services/test_pc_registry_service.py`
- `backend/tests/services/test_status_service.py`
- `backend/tests/services/test_wol_service.py`
- `backend/tests/services/test_job_and_event_service.py`
- `backend/tests/services/test_status_monitor_service.py`
- `backend/tests/services/test_pc_service.py`

## `pc_registry_service`

- `test_pc_registry_validation_errors`
  - `status_method` は `tcp/ping` のみ許可。
  - `send_interface` に `wg*` を許可しない。
  - 不正status値を拒否。

## `status_service`

- `test_status_service_missing_pc_and_required_id`
  - 空白 `pc_id` と未登録PCで `ValueError`。
  - 失敗ログ（`action=status`, `status=failed`）が記録される。

- `test_status_service_tcp_online_and_offline`
  - TCP connect 成功で `online`。
  - timeoutで `offline`。
  - 両結果がログに残る。

- `test_status_service_ping_paths`
  - ping戻り値 `0` で `online`、`1` で `offline`。
  - pingコマンド不在で `ValueError`。
  - 失敗ログが残る。

- `test_status_service_raises_when_ip_is_not_configured`
  - `ip_address` 未設定時は `ValueError` を送出する。
  - `action=status` ログに `status=failed` が記録される。

## `wol_service`

- `test_wol_service_error_paths`
  - 空白ID、未登録PC、不正port、不正broadcast、ネットワーク外IPを拒否。
  - 失敗ログが残る。

- `test_wol_service_success_path`
  - 正常系で送信先MAC/broadcast/port/source_ipが期待どおりに計算される。
  - 送信成功ログ（`status=sent`）が残る。

## `job_service` / `event_service`

- `test_job_service_run_job_success_and_failure`
  - 成功時: `running -> succeeded` とイベント発行。
  - 失敗時: `running -> failed` とイベント発行、エラー内容保持。

- `test_event_broker_stream_receives_published_event`
  - publishしたSSEイベントをstream購読で受信できる。

- `test_create_or_get_active_job_recovers_stale_active_job`
  - `queued/running` の active job がしきい値より古い場合、`failed` へ回収してから新規jobを作成できること。

- `test_get_active_job_by_type_skips_stale_row`
  - 取得した active job が stale の場合、`failed` へ回収して次の有効jobを返せること。

## `status_monitor_service`（60秒監視）

- `test_status_monitor_enqueue_reuses_active_job`
  - `status_refresh_all` が active の場合、新規作成せず既存job_idを返す。

- `test_status_monitor_enqueue_creates_job_and_publishes`
  - active job がない場合、新規ジョブ作成・実行タスク起動・`job` イベントpublishを行う。

## `pc_service.send_wol`（bootingポーリング）

- `test_pc_service_send_wol_polls_every_3_seconds_until_online`
  - WOL送信後に `booting` へ遷移。
  - 3秒間隔ポーリング中に `online` を検出したら終了。
  - `mark_seen=True` で更新される。

- `test_pc_service_send_wol_poll_timeout_marks_offline_or_unknown`
  - 規定回数で `online` にならなければタイムアウト。
  - `last_seen_at` なし: `unknown`。
  - `last_seen_at` あり: `offline`。

- `test_pc_service_send_wol_marks_unreachable_on_status_probe_error`
  - ステータス判定処理が例外になった場合は `unreachable` に更新されること。

- `test_refresh_pc_status_keeps_unreachable_when_probe_is_offline`
  - 既に `unreachable` のPCは、ステータス確認結果が `offline` でも `unreachable` を維持すること。

## 運用時の注意点

- ここで担保しているのは「ロジック分岐」であり、実ネットワーク疎通は統合テスト/実機確認が必要。
