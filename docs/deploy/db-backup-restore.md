# Deploy DB Ops Notes

## 目的

- SQLite バックアップを自動実行し、障害時に復元できる状態を維持する。
- バックアップ仕様と Alembic 連携ルールを明文化する。

## 変更内容

- 2026-03-02: SQLite バックアップ運用仕様（世代管理/オプション/自動化/systemd timer）を追加。
- 2026-03-02: 定期バックアップ時刻を 03:15 から 07:00 に変更。
- 2026-03-02: デフォルト保持世代を 30 に確定。
- 2026-03-03: 配置先を `docs/deploy/db/README.md` から `docs/deploy/db-backup-restore.md` へ移設。

## SQLiteバックアップ運用仕様（v1）

### 用語

- 世代管理:
  - バックアップを「最新 N 個だけ残す」運用。
  - 例: `keep=30` の場合、31個目以降の古いファイルを削除する。
- オプション:
  - スクリプト実行時に挙動を切り替える引数。
  - 例: `--dry-run`（実際には作成/削除しない）、`--keep 30`（保持数を30へ変更）。

### スコープ

- 対象DB: `backend/app/db/app.db`
- 保存先: `backend/backups/`
- バックアップ方式: Python `sqlite3` backup API を利用（整合性を優先）
- ファイル名: `app-YYYYmmdd-HHMMSS.db`
- デフォルト保持数: 30世代

### バックアップスクリプトのオプション

- `--dry-run`: 作成予定/削除予定のみ表示して終了する。
- `--keep N`: 保持世代数を上書きする（デフォルトは 30）。
- `--output-dir PATH`: 出力先を変更する（デフォルトは `backend/backups/`）。

### 自動化方針（手動ではなく定期実行）

- 実行基盤は `systemd timer` を採用する（Raspberry Pi 運用前提）。
- 日次で毎朝1回の実行を基本にする（例: 毎日 07:00）。
- 推奨設定:
  - `Persistent=true`（停止中に取り逃した実行を復帰後に補完）
  - `RandomizedDelaySec=300`（起動集中の分散）
- 本リポジトリの unit ファイル配置:
  - `deploy/systemd/wol-db-backup.service`
  - `deploy/systemd/wol-db-backup.timer`

`wol-db-backup.service` 例:

```ini
[Unit]
Description=Backup raspi-vpn-wol SQLite DB

[Service]
Type=oneshot
WorkingDirectory=/opt/raspi-vpn-wol/backend
ExecStart=/opt/raspi-vpn-wol/backend/.venv/bin/python scripts/backup_db.py --keep 30
```

`wol-db-backup.timer` 例:

```ini
[Unit]
Description=Daily SQLite backup for raspi-vpn-wol

[Timer]
OnCalendar=*-*-* 07:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

- 推奨値:
  - `--keep 30`（日次運用で約1か月分を保持）

### Alembicとの関係（重要）

- Alembic は「スキーマ変更」、バックアップは「データ保全」。役割が異なるため両方必要。
- 原則として `alembic upgrade head` の前にバックアップを1回取得する。
- 復元後は `alembic current` と `alembic upgrade head` で整合性を確認する。

### 障害時の復元手順（最小）

1. `wol-api.service` を停止する。
2. 現在DBを退避し、バックアップDBを `backend/app/db/app.db` に配置する。
3. `alembic upgrade head` を実行する（必要な差分のみ適用）。
4. `wol-api.service` を起動し、`/api/health` が `200` を返すことを確認する。

## 運用時の注意点

- バックアップ保存先は容量監視を行い、保持世代数の変更時は根拠を残す。
- 復元作業時は必ず「復元前の現行DB」を別名で退避してから置換する。
