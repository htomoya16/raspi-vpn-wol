# Backend Test Docs

## 目的

- `backend/tests` のテスト意図を、ファイル単位で素早く確認できるようにする。
- 仕様変更時に「どのテストを更新すべきか」を判断しやすくする。

## 対象ファイル

- `backend/tests/conftest.py`
- `backend/tests/test_api_minimum.py`
- `backend/tests/test_api_comprehensive.py`
- `backend/tests/test_services_unit.py`

## ドキュメント一覧

- `docs/backend/tests/conftest.md`
- `docs/backend/tests/api-minimum.md`
- `docs/backend/tests/api-comprehensive.md`
- `docs/backend/tests/services-unit.md`

## 実行方法

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

## 運用時の注意点

- API仕様変更時は `docs/backend/api/openapi.md` とあわせて該当テスト/テストドキュメントを更新する。
- テスト追加時は、このディレクトリ配下に要約ドキュメントを追加する。
