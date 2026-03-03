# Deploy nginx Notes

## 目的

- Raspberry Pi 本番での nginx 設定手順を固定化する。
- 静的配信（`/`）と API リバースプロキシ（`/api`）の境界を明文化する。

## 変更内容

- 2026-03-03: nginx 運用手順を追加。
- 2026-03-03: `deploy/nginx/wol.conf` を参照する手順を追加。

## 設定ファイル

- リポジトリ配置: `deploy/nginx/wol.conf`
- 配置先: `/etc/nginx/sites-available/wol.conf`

`/` は `frontend/dist` 配置先（例: `/var/www/wol`）を配信し、`/api/` は `127.0.0.1:8000` の FastAPI へ転送する。

## 反映手順

```bash
sudo cp deploy/nginx/wol.conf /etc/nginx/sites-available/wol.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/wol.conf /etc/nginx/sites-enabled/wol.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 動作確認

```bash
curl -I http://127.0.0.1/
curl -s http://127.0.0.1/api/health
```

- 期待結果:
  - `/` は `200`
  - `/api/health` は JSON 応答

## 運用時の注意点

- `proxy_pass` の転送先 (`127.0.0.1:8000`) は FastAPI 実際の listen 先と一致させる。
- SSE を使うため `proxy_buffering off` を維持する。
- 管理画面は VPN/LAN 内のみ公開し、インターネットへの直接公開を避ける。
