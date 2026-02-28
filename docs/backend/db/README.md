# Backend DB Docs

## 目的

- DB関連ドキュメントの入口を1箇所にまとめる。
- スキーマ全体・インデックス・uptime詳細を用途別に参照しやすくする。

## 参照先

- `docs/backend/db/er.md`
  - DBスキーマ全体（正）
- `docs/backend/db/indexes.md`
  - 実クエリとインデックスの対応
- `docs/backend/db/uptime-tables.md`
  - uptime系テーブル（`status_history` / `uptime_daily_summary`）の詳細

## 運用時の注意点

- スキーマ変更時は、最低でも `er.md` を更新する。
- インデックス変更時は `indexes.md` も同時更新する。
- uptime関連の集計/保持方針変更時は `uptime-tables.md` も同時更新する。
