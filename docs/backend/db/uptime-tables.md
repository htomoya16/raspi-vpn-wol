# Uptime Tables DDL (Design Draft)

## 目的

- uptime機能（日次グラフ / 週タイムライン）で使うDBテーブル定義を先に固定する。
- 実装時に「どのカラムをどのAPIで使うか」を迷わない状態にする。

## 変更内容

- `status_history`（状態変化履歴）と `daily_uptime_summary`（日次集計）のDDL案を定義。
- インデックス方針と保持期間削除SQLの方針を追記。
- 本ドキュメントは設計案であり、現時点では未実装。

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

CREATE INDEX IF NOT EXISTS idx_status_history_pc_changed_at
ON status_history (pc_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
ON status_history (changed_at DESC);
```

```sql
CREATE TABLE IF NOT EXISTS daily_uptime_summary (
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

CREATE INDEX IF NOT EXISTS idx_daily_uptime_date
ON daily_uptime_summary (date DESC);
```

## 保存ルール（前提）

- `status_history` は「状態変化時のみ保存」する。
- `status` が `online` のときのみ `is_online=1`。それ以外は `0`。
- 日次グラフは `daily_uptime_summary` を返し、`online_ratio` はAPI側で算出する。

## 保持期間ポリシー

- `status_history`: 1年保持
- `daily_uptime_summary`: 無期限保持

```sql
-- status_history の期限切れ削除（1年）
DELETE FROM status_history
WHERE changed_at < datetime('now', '-365 days');
```

## APIとの対応

- `GET /api/pcs/{pc_id}/uptime/daily`
  - 主に `daily_uptime_summary` を参照。
- `GET /api/pcs/{pc_id}/uptime/weekly`
  - `status_history` を区間化して返却。

## 運用時の注意点

- 実装時にDDLが変わった場合は `docs/backend/db/er.md` と `docs/backend/api/openapi.md` を同時更新する。
- 時刻文字列は既存方針に合わせてUTC ISO形式で保存し、APIレスポンスで `tz` に沿って整形する。
