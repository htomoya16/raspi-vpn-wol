# Backend Test Docs

## 目的

- `backend/tests` のテスト意図を、ファイル単位で素早く確認できるようにする。
- 仕様変更時に「どのテストを更新すべきか」を判断しやすくする。

## 対象ファイル

- `backend/tests/conftest.py`
- `backend/tests/api/test_minimum.py`
- `backend/tests/api/test_pcs_api.py`
- `backend/tests/api/test_status_api.py`
- `backend/tests/api/test_wol_api.py`
- `backend/tests/api/test_jobs_api.py`
- `backend/tests/api/test_logs_api.py`
- `backend/tests/api/test_events_api.py`
- `backend/tests/services/test_pc_registry_service.py`
- `backend/tests/services/test_status_service.py`
- `backend/tests/services/test_wol_service.py`
- `backend/tests/services/test_job_and_event_service.py`
- `backend/tests/services/test_status_monitor_service.py`
- `backend/tests/services/test_pc_service.py`
- `backend/tests/db/test_database_init.py`
- `backend/tests/runtime/test_lifespan.py`

## ドキュメント一覧

- `docs/backend/tests/conftest.md`
- `docs/backend/tests/api-minimum.md`
- `docs/backend/tests/api-comprehensive.md`
- `docs/backend/tests/services-unit.md`
- `docs/backend/tests/db-init.md`
- `docs/backend/tests/runtime-lifespan.md`

## 実行方法

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

```bash
cd backend
python scripts/seed_dev_data.py
```

## 運用時の注意点

- API仕様変更時は `docs/backend/api/openapi.md` とあわせて該当テスト/テストドキュメントを更新する。
- テスト追加時は、このディレクトリ配下に要約ドキュメントを追加する。
