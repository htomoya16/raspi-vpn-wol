# Deploy and Ops Notes

## 目的

- nginx、systemd、配布フロー（PC build -> Raspberry Pi 配備）を整理する。
- 本番運用時の確認手順とトラブルシュートを集約する。
- 各運用トピックへの入口ページとして、参照先を一元化する。

## 変更内容

- 2026-02-11: デプロイ/運用向けドキュメントの初期ページを作成。
- 2026-03-02: DB運用ドキュメントを `docs/deploy/db/` へ分離し、当ページを入口化。
- 2026-03-02: DBバックアップの運用決定値（毎日07:00、30世代保持）を追記。
- 2026-03-03: UFW（OS側ネットワーク制限）手順への導線を追加。

## 目次

- Raspberry Pi運用フロー:
  - `docs/deploy/raspi-ops-flow.md`（初回セットアップ〜更新までの一連手順）
- nginx運用:
  - `docs/deploy/nginx.md`（`wol.conf` 反映、`/` 配信、`/api` リバプロ）
- OSネットワーク制限:
  - `docs/deploy/ufw.md`（22/80 を VPN セグメントに限定）
- systemd運用:
  - `docs/deploy/systemd.md`（バックアップ service/timer の有効化と確認）
- 運用ランブック:
  - `docs/deploy/runbook.md`（運用開始前チェック、障害時初動、復旧確認）
- DB運用:
  - `docs/deploy/db/README.md`（バックアップ/復元仕様、systemd timer、Alembic連携）
  - 運用決定値: 毎日 `07:00` 実行、`keep=30`（約1か月分）

## 運用時の注意点

- `nginx` の `/api` リバプロ先と FastAPI の listen 設定を常に一致させる。
- 公開インターフェースは VPN/LAN 内に限定し、外部公開設定を避ける。
- 配布手順変更時はロールバック方法もあわせて更新する。

## 今後の追記候補

- 配布コマンド手順（dist 同期、サービス再起動）
- 障害時チェックリスト（nginx/FastAPI/SQLite）
- バックアップ結果の通知（journal確認/外部通知）
