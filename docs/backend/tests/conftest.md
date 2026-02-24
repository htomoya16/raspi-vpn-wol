# `conftest.py` Summary

## 目的

- APIテスト実行時の共通初期化を1か所に集約する。
- 本番/開発DBを汚さずにテストできる状態を作る。

## 実施内容

- `backend/` を `sys.path` に追加して、実行ディレクトリ差分による import エラーを防止。
- `client` fixture で `app.db.database.DB_PATH` を `tmp_path` 配下の一時SQLiteへ差し替え。
- `TestClient(app)` を `with` で生成/破棄し、各テストを独立実行。

## 期待される効果

- テスト間でデータが混ざらない。
- ローカル実DB（`backend/app/db/app.db`）を破壊しない。
