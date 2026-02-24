# `runtime/test_lifespan.py` Summary

## 目的

- `app.main.lifespan` の起動/終了フロー（DB初期化・監視タスク開始・停止）を保証する。
- 定期監視タスクのリークを防ぐ。

## 対象ファイル

- `backend/tests/runtime/test_lifespan.py`

## テストケース一覧

- `test_lifespan_starts_and_cancels_status_monitor`
  - lifespan開始時に `init_db()` が呼ばれること。
  - 監視タスクが開始されること。
  - lifespan終了時に監視タスクが `cancel` されること。

## 運用時の注意点

- `main.py` の `lifespan` 制御や監視タスク起動条件を変更したら、最初にこのテストを更新する。
