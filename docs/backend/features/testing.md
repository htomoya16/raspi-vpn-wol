# Testing Feature

## 目的

- APIの主要機能が壊れていないことを自動確認できるようにする。
- 手動確認の負担を下げ、リファクタ時の回帰を早期検知する。

## 変更内容

- `backend/tests/conftest.py` を追加。
  - 各テストで `DB_PATH` を一時SQLiteファイルに差し替え、実DBを汚さない構成にした。
- `backend/tests/api/test_minimum.py` を追加。
  - `GET /api/health`
  - `POST/GET/PATCH/DELETE /api/pcs`
  - `POST /api/pcs/{pc_id}/wol`（ジョブ受付）
  - `GET /api/jobs/{job_id}`
  - `GET /api/logs`（フィルタ検証含む）
- `backend/requirements-dev.txt` を追加。
  - `pytest` / `httpx` を開発用依存として分離。
- `backend/tests/api/*.py` を追加。
  - API仕様（バリデーション/フィルタ/エラーマッピング/SSE）を網羅的に確認。
- `backend/tests/services/*.py` を追加。
  - service層の分岐ロジック（status/wol/job/event/monitor）をモックで検証。
- `backend/tests/db/*.py` を追加。
  - `init_db()` のマイグレーション挙動（MAC正規化/重複検出）を検証。
- `backend/tests/runtime/*.py` を追加。
  - `lifespan` の起動/終了で監視タスクが適切に管理されることを検証。
- `docs/backend/tests/` を追加。
  - テストファイルごとの目的・ケース一覧・更新時注意点を文書化。
- `backend/scripts/seed_dev_data.py` を追加。
  - 開発用の `pcs` / `status_history` / `uptime_daily_summary` / `logs` を再投入できるようにした。

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

- 現在の最小テストは「API I/F と代表的な異常系」の回帰確認が中心。
- `status` / `wol` の実ネットワーク疎通は、unitテストではなく実機確認で担保する。
- テスト仕様の参照は `docs/backend/tests/README.md` を入口にする。
