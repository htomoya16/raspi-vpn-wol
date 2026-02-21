# raspi-vpn-wol

VPN 接続済み端末から、自宅 LAN 内 PC へ Wake-on-LAN を送信するための Web ダッシュボードです。

## ドキュメント

- プロジェクト全体: `docs/README.md`
- フロントエンド: `docs/frontend/README.md`
- バックエンド: `docs/backend/README.md`
- デプロイ/運用: `docs/deploy/README.md`

## 開発（ローカル）

### Backend

```bash
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

- 現在 `frontend/` は学習用に初期化済み（実装は未着手）。
- 実務スタイルで、要件整理から1ステップずつ実装していく方針。
## API契約

- API契約の詳細は `docs/backend/api/openapi.md` を参照してください。
