# Raspberry Pi運用 手順書（初回〜更新）

## 目的

- 第三者が見ながら同じ手順で Raspberry Pi 運用を開始できるようにする。
- 初回セットアップと、以後の更新手順を1ページで再現可能にする。

## 変更内容

- 2026-03-03: Raspberry Pi 運用フロー（初回/更新）を追加。
- 2026-03-03: SSH接続後に実行する初回手順として `/opt/raspi-vpn-wol` 配置手順を明記。
- 2026-03-03: nginx 未導入時のインストール手順を追記。
- 2026-03-03: UFW（OS側ネットワーク制限）の推奨手順への案内を追記。
- 2026-03-03: 手順順序を「PC準備 -> Pi基盤 -> アプリ反映 -> 最終確認」に整理。

## 前提

- Raspberry Pi に `git` / `python` / `nginx` / `systemd` がある。
- リポジトリ配置先は `/opt/raspi-vpn-wol` とする。
- Frontend の build は PC 側で行い、`dist/` を Raspberry Pi に配布する。
- `<RASPI_USER>` / `<RASPI_IP>` が分かっており、SSH 接続できる。

## ここからの手順（初回）

### 1. PC側: SSH 接続確認

```bash
ssh <RASPI_USER>@<RASPI_IP>
```

- 期待結果:
  - Raspberry Pi のシェルに入れる

### 2. Raspberry Pi側（SSH接続後）: 基盤ディレクトリと nginx を準備

```bash
sudo mkdir -p /var/www/wol
sudo chown -R $USER:$USER /var/www/wol
sudo mkdir -p /opt/raspi-vpn-wol
sudo chown -R $USER:$USER /opt/raspi-vpn-wol
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
sudo systemctl status nginx --no-pager
```

- 期待結果:
  - `/var/www/wol` が作成される
  - `/opt/raspi-vpn-wol` が作成される
  - `<RASPI_USER>` で両ディレクトリに書き込み可能になる
  - nginx がインストールされる
  - `nginx` サービスが `active (running)` になる

### 3. Raspberry Pi側（SSH接続後）: UFW を先に設定（推奨）

- 22/80 を LAN/VPN のみに制限するため、アプリ反映前に UFW 設定を推奨。
- 詳細手順は `docs/deploy/ufw.md` を参照。

### 4. Raspberry Pi側（SSH接続後）: リポジトリを取得して main に合わせる

```bash
git clone https://github.com/htomoya16/raspi-vpn-wol.git /opt/raspi-vpn-wol
cd /opt/raspi-vpn-wol
git fetch origin
git switch main || git switch -c main --track origin/main
git pull origin main
```

- 期待結果:
  - 初回はリポジトリが clone される
  - `main` ブランチに切り替わる
  - 最新コミットが取り込まれる
- 補足:
  - 既に `/opt/raspi-vpn-wol/.git` がある場合は `git clone` を省略して `cd /opt/raspi-vpn-wol` から実行する。

### 5. Raspberry Pi側（SSH接続後）: Backend 依存導入とマイグレーション

```bash
cd /opt/raspi-vpn-wol/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
```

- 期待結果:
  - `.venv` が作成される
  - 依存導入が成功する
  - DB スキーマが `head` になる

### 6. Raspberry Pi側（SSH接続後）: systemd / nginx 設定を反映

```bash
cd /opt/raspi-vpn-wol
sudo cp deploy/systemd/wol-api.service /etc/systemd/system/
sudo cp deploy/systemd/wol-db-backup.service /etc/systemd/system/
sudo cp deploy/systemd/wol-db-backup.timer /etc/systemd/system/
sudo cp deploy/nginx/wol.conf /etc/nginx/sites-available/wol.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/wol.conf /etc/nginx/sites-enabled/wol.conf
sudo systemctl daemon-reload
sudo systemctl enable --now wol-api.service
sudo systemctl enable --now wol-db-backup.timer
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status wol-api.service --no-pager
sudo systemctl status wol-db-backup.timer --no-pager
```

- 期待結果:
  - `wol-api.service` が `active (running)` になる
  - `wol-db-backup.timer` が `active (waiting)` になる
  - `nginx -t` が `test is successful` を返す

### 7. PC側: Frontend を build して Raspberry Pi へ配布

```bash
cd frontend
npm ci
npm run build
rsync -av --delete dist/ <RASPI_USER>@<RASPI_IP>:/var/www/wol/
```

- 期待結果:
  - `frontend/dist/` が生成される
  - Raspberry Pi の `/var/www/wol` が最新化される
- 補足:
  - `<RASPI_USER>@<RASPI_IP>` は SSH 接続先の指定（例: `pi@192.168.10.15`）。
  - `rsync` は SSH 経由で `dist/` を Raspberry Pi に転送する。

### 8. Raspberry Pi側（SSH接続後）: 最終疎通確認

```bash
curl -I http://127.0.0.1/
curl -s http://127.0.0.1/api/health
sudo systemctl status nginx --no-pager
sudo systemctl status wol-api.service --no-pager
sudo systemctl list-timers --all | grep wol-db-backup
```

- 期待結果:
  - `/` が `200`
  - `/api/health` が JSON 応答
  - `nginx` と `wol-api.service` が `active (running)`
  - `wol-db-backup.timer` が表示される

## 更新時（2回目以降）

### 1. Raspberry Pi側（SSH接続後）: コード更新と DB 追従

```bash
cd /opt/raspi-vpn-wol
git pull origin main
cd backend
source .venv/bin/activate
alembic upgrade head
```

- 期待結果:
  - `main` の最新変更が取り込まれる
  - DB スキーマが `head` になる

### 2. PC側: Frontend を再buildして配布

```bash
cd frontend
npm ci
npm run build
rsync -av --delete dist/ <RASPI_USER>@<RASPI_IP>:/var/www/wol/
```

- 期待結果:
  - `frontend/dist/` が再生成される
  - Raspberry Pi の `/var/www/wol` が最新化される

### 3. Raspberry Pi側（SSH接続後）: サービス再反映と確認

```bash
cd /opt/raspi-vpn-wol
sudo cp deploy/nginx/wol.conf /etc/nginx/sites-available/wol.conf
sudo ln -sf /etc/nginx/sites-available/wol.conf /etc/nginx/sites-enabled/wol.conf
sudo cp deploy/systemd/wol-api.service /etc/systemd/system/
sudo cp deploy/systemd/wol-db-backup.service /etc/systemd/system/
sudo cp deploy/systemd/wol-db-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart wol-api.service
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status wol-api.service --no-pager
sudo systemctl status wol-db-backup.timer --no-pager
```

- 期待結果:
  - `wol-api.service` が `active (running)` になる
  - `nginx -t` が成功する
  - `wol-db-backup.timer` が `active (waiting)` を維持する

## 運用時の注意点

- `frontend` build は Raspberry Pi ではなく PC で行う。
- 運用DBは初期化せず、基本は `alembic upgrade head` で追従する。
- 外部公開は行わず、VPN/LAN 内アクセスに限定する。
- adminトークン喪失時の復旧は `docs/deploy/token-ops.md`（`create_api_token.py`）を参照する。
