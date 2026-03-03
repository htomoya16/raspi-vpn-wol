# Uptime Tables DDL

## 目的

- uptime機能（日次グラフ / 週タイムライン）で使うDBテーブル定義を先に固定する。
- 実装時に「どのカラムをどのAPIで使うか」を迷わない状態にする。

## 変更内容

- `status_history`（状態変化履歴）と `uptime_daily_summary`（日次集計）のDDLを定義。
- インデックス方針と保持期間削除SQLの方針を追記。
- 2026-02-27: 実クエリに合わせて `status_history` / `uptime_daily_summary` のインデックスを更新。
- 2026-02-27: 保持期間削除で `datetime(...)` 比較をやめ、UTC ISO文字列との直接比較に統一。
- 本ドキュメントは実装済みスキーマを正として扱う。

## DDL案

```sql
CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pc_id TEXT NOT NULL,
    status TEXT NOT NULL,
    is_online INTEGER NOT NULL CHECK (is_online IN (0, 1)),
    changed_at TEXT NOT NULL,
    source TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_status_history_pc_changed_id
ON status_history (pc_id, changed_at, id);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
ON status_history (changed_at);
```

```sql
CREATE TABLE IF NOT EXISTS uptime_daily_summary (
    pc_id TEXT NOT NULL,
    date TEXT NOT NULL,
    tz TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    online_seconds INTEGER NOT NULL DEFAULT 0 CHECK (online_seconds BETWEEN 0 AND 86400),
    online_count INTEGER NOT NULL DEFAULT 0,
    offline_count INTEGER NOT NULL DEFAULT 0,
    first_online_at TEXT,
    last_online_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pc_id, date, tz),
    FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uptime_daily_summary_pc_tz_date
ON uptime_daily_summary (pc_id, tz, date ASC);
```

## 保存ルール（前提）

- `status_history` は「状態変化時のみ保存」する。
- `status` が `online` のときのみ `is_online=1`。それ以外は `0`。
- 集計APIは `uptime_daily_summary` を正として返却する。
- `bucket=day` はそのまま返却し、`bucket=week|month|year` はAPI側で再集約する。
- `online_ratio` はAPI側で算出する。

## 保持期間ポリシー

- `status_history`: 1年保持
- `uptime_daily_summary`: 無期限保持

```sql
-- status_history の期限切れ削除（1年）
DELETE FROM status_history
WHERE changed_at < ?;
```

- `?` にはアプリ側で計算した UTC ISO 時刻（例: `2025-02-27T00:00:00+00:00`）を渡す。
- 列に `datetime(...)` 関数をかけずに比較することで、`idx_status_history_changed_at` を使いやすくする。

## APIとの対応

- `GET /api/pcs/{pc_id}/uptime/summary`
  - `uptime_daily_summary` を参照し、`bucket` に応じて集約して返す。
- `GET /api/pcs/{pc_id}/uptime/weekly`
  - `status_history` を区間化して返却。
  - `week_start` は日曜始まり（`YYYY-MM-DD`）。未指定時は `tz` 基準の当週日曜。

## 運用時の注意点

- 実装時にDDLが変わった場合は `docs/backend/db/er.md` と `docs/backend/api/openapi.md` を同時更新する。
- 時刻文字列は既存方針に合わせてUTC ISO形式で保存し、APIレスポンスで `tz` に沿って整形する。
