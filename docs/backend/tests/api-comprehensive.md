# `test_api_comprehensive.py` Summary

## 目的

- API I/Fの詳細仕様（バリデーション、競合、フィルタ、エラーマッピング）を包括的に検証する。
- 仕様変更時の破壊的変更を早期に検知する。

## PC API

- `test_pcs_create_without_id_generates_unique_slug_ids`
  - `id` 未指定時に `name` ベースの自動IDが生成されること。
  - 同名PCでもIDがユニークであること。

- `test_pcs_create_validation_and_conflict`
  - 不正MACで `400`。
  - 必須項目不足で `422`。
  - 重複IDで `409`。

- `test_pcs_list_filters_by_query_tag_status_and_cursor`
  - `q` / `tag` / `status` / `cursor` の各フィルタ挙動を確認。
  - 不正status値で `422`。

- `test_pcs_patch_preserves_unspecified_fields`
  - PATCHで未指定フィールドが保持されること。

- `test_pcs_not_found_and_patch_validation`
  - 未存在IDの GET/PATCH/DELETE が `404`。
  - PATCH不正入力で `422`。

- `test_delete_pc_creates_pc_delete_log`
  - DELETE後に `action=pc_delete` の成功ログが残ること。

## Status API

- `test_status_refresh_without_ip_returns_unreachable`
  - `ip` 未設定PCの status refresh が `200` で `status=unreachable` になること。
  - 失敗ログが記録されること。

- `test_status_refresh_http_error_mapping`
  - 未存在PCで `404`。
  - service層 `ValueError` が `400` にマップされること。

## WOL API

- `test_wol_endpoint_builds_job_payload_with_overrides`
  - `repeat/broadcast/port` を指定したときのジョブpayload構築を検証。
  - `202` で `job_id/state` を返すこと。

- `test_wol_endpoint_validation_and_not_found`
  - `repeat=0` で `422`。
  - 未存在PCで `404`。

## Jobs API

- `test_refresh_all_statuses_returns_job_accepted`
  - 全体status更新APIが `202` を返し、作成ジョブを取得できること。

- `test_jobs_endpoint_error_mapping`
  - 未存在jobで `404`。
  - 空白job_idで `400`。

## Logs API

- `test_logs_filters_validation_and_cursor`
  - `limit` / `cursor` の入力バリデーション（`422`）を確認。
  - `next_cursor` を使ったページング挙動を確認。
  - `action`/`ok` フィルタが効くことを確認。

## Events API

- `test_events_endpoint_streams_sse_content`
  - `GET /api/events` が `text/event-stream` を返すこと。
  - SSE本文にイベント文字列が含まれること。

## 運用時の注意点

- APIレスポンス仕様を変更したら、このファイルと `docs/backend/api/openapi.md` を同時更新する。
