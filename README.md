# raspi-vpn-wol

VPN 接続済み端末から、自宅 LAN 内 PC を管理するための Web ダッシュボードです。  
`WOL送信`、`起動状態更新`、`操作ログ確認`、`稼働時間可視化` を提供します。

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

## ローカル開発

### Backend

```bash
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- `pip install`: 開発用依存を導入する
- `uvicorn`: APIサーバをローカル起動する

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
python scripts/seed_dev_data.py
```

- 稼働時間やログの確認に使う開発用シードデータを再投入する

## ドキュメント

- プロジェクト全体: `docs/README.md`
- フロントエンド: `docs/frontend/README.md`
- バックエンド: `docs/backend/README.md`
- デプロイ/運用: `docs/deploy/README.md`

## 仕様の正

- API契約: `docs/backend/api/openapi.md`
- DBスキーマ: `docs/backend/db/er.md`

## 運用前提

- 管理画面は VPN 内アクセス前提（インターネットへ直接公開しない）
