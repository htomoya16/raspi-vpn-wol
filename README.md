# raspi-vpn-wol

VPN 接続済み端末から、自宅 LAN 内 PC を管理するための Web ダッシュボードです。  
`WOL送信`、`起動状態更新`、`操作ログ確認`、`稼働時間可視化` を提供します。
スマホ / PC からの実運用イメージは、下記デモ動画で確認できます。

## デモ動画

[![raspi-vpn-wol デモ動画](https://img.youtube.com/vi/xwnNt2OvFIQ/maxresdefault.jpg)](https://youtu.be/xwnNt2OvFIQ)

動画リンク: https://youtu.be/xwnNt2OvFIQ


## 主な機能

- PC管理: 一覧 / 登録 / 更新 / 削除
- WOL: `POST /api/pcs/{pc_id}/wol` でジョブ投入
- 状態更新: 単体更新 / 全体更新（ジョブ）
- ログ/ジョブ: 操作ログ表示とジョブ状態追跡
- 稼働時間: オンライン集計（日次/週次/月次/年次）と稼働タイムライン
- SSE: イベント通知で画面状態を同期

## 構成

- Frontend: React + Vite + TypeScript
- Backend: FastAPI
- DB: SQLite
- 配備: nginx + systemd（ラズパイ想定）

### 技術スタック

![raspi-vpn-wol 技術スタック](<docs/images/raspi-wol - 技術スタック.jpg>)

### システム構成図

![raspi-vpn-wol システム構成図](<docs/images/raspi-wol - システム構成図.jpg>)

## ローカル開発

### Backend

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- `pip install`: 開発用依存を導入する
- `uvicorn`: APIサーバをローカル起動する
- `source .venv/bin/activate`: backend の仮想環境を有効化する
- 依存追加の原則:
  - 本番実行で必要な依存は `backend/requirements.txt` に追加する
  - 開発/テスト専用の依存は `backend/requirements-dev.txt` に追加する

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

- `npm ci`: lockfile準拠で依存を再現導入する
- `npm run dev`: Vite 開発サーバを起動する

## テスト / 品質確認

### Backend

```bash
cd backend
source .venv/bin/activate
pytest -q
```

### Frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm run test
```

## 開発用データ投入

```bash
cd backend
source .venv/bin/activate
python scripts/seed_dev_data.py
```

- 稼働時間やログの確認に使う開発用シードデータを再投入する
- `pcs` / `status_history` / `uptime_daily_summary` / `jobs` / `logs` を開発確認向けに投入する

## DBバックアップ（運用）

```bash
cd backend
source .venv/bin/activate
python scripts/backup_db.py --dry-run
python scripts/backup_db.py --keep 30
```

- `--dry-run`: 作成/削除予定だけ表示して、ファイルは変更しない
- `--keep 30`: 最新30世代を残して古いバックアップを削除する
- 詳細仕様（自動化/systemd timer/復元手順）は `docs/deploy/db-backup-restore.md` を参照

## ドキュメント

- プロジェクト全体: `docs/README.md`
- フロントエンド: `docs/frontend/README.md`
- バックエンド: `docs/backend/README.md`
- デプロイ/運用: `docs/deploy/README.md`
- Raspberry Pi運用フロー: `docs/deploy/raspi-ops-flow.md`
- CI/CD運用: `docs/deploy/cicd.md`
- nginx運用: `docs/deploy/nginx.md`
- OSネットワーク制限（UFW）: `docs/deploy/ufw.md`
- systemd運用: `docs/deploy/systemd.md`
- 運用ランブック: `docs/deploy/runbook.md`
- DB運用（バックアップ/復元）: `docs/deploy/db-backup-restore.md`
- APIトークン運用（break-glass）: `docs/deploy/token-ops.md`

## 仕様の正

- API契約: `docs/backend/api/openapi.md`
- DBスキーマ: `docs/backend/db/er.md`

## 運用前提

- 管理画面は VPN 内アクセス前提（インターネットへ直接公開しない）
- 本番はデプロイ工程で `alembic upgrade head` を実行し、アプリ起動時マイグレーションは `RUN_MIGRATIONS_ON_STARTUP=0` を推奨
- API認証は端末別 Bearer トークン方式（`Authorization: Bearer <token>`）
