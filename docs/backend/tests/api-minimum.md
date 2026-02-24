# `test_api_minimum.py` Summary

## 目的

- APIの主要導線（health / pcs CRUD / wol job / logs）が最低限壊れていないことを確認する。
- 回帰時に最短で異常検知できるスモークテストを提供する。

## テストケース一覧

- `test_health_ok`
  - `GET /api/health` が `200` と `{"status":"ok"}` を返すことを確認。

- `test_pcs_crud_flow`
  - `POST /api/pcs` で作成できること。
  - MAC正規化（`aa-bb-...` -> `AA:BB:...`）されること。
  - `GET /api/pcs` / `GET /api/pcs/{id}` で参照できること。
  - `PATCH /api/pcs/{id}` で更新できること。
  - `DELETE /api/pcs/{id}` 後に `404` になること。

- `test_pcs_duplicate_id_returns_409`
  - 同じ `id` の2回目登録が `409` で拒否されること。

- `test_logs_supports_filters`
  - `pc_id` フィルタ付き `GET /api/logs` が `200` を返し、対象PCのログだけを返すこと。

- `test_wol_job_is_accepted_and_visible`
  - `POST /api/pcs/{id}/wol` が `202` と `job_id` を返すこと。
  - `GET /api/jobs/{job_id}` でジョブ状態を参照できること。
  - 非同期実行のため状態が `queued/running/succeeded/failed` のいずれかであること。

## 補足

- 本ファイルは「最小保証」のため、詳細なバリデーション・異常系は `test_api_comprehensive.py` 側で担保する。
