# `db/test_database_init.py` Summary

## 目的

- `init_db()` の起動時マイグレーション挙動（MAC正規化・重複検出）を保証する。
- DB整合性エラーを起動前に検知できることを担保する。

## 対象ファイル

- `backend/tests/db/test_database_init.py`

## テストケース一覧

- `test_init_db_normalizes_existing_mac_addresses`
  - 既存レコードの `aa-bb-...` 形式MACが再初期化時に `AA:BB:...` へ正規化されることを確認。

- `test_init_db_raises_when_duplicate_mac_exists`
  - 正規化後に同一MACが重複する場合、`RuntimeError`（重複MAC）で起動失敗することを確認。

## 運用時の注意点

- `pcs.mac_address` の一意制約や正規化仕様を変更した場合は、このテストを最優先で更新する。
