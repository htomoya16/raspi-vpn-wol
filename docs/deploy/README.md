# Deploy and Ops Notes

## 目的

- nginx、systemd、配布フロー（PC build -> Raspberry Pi 配備）を整理する。
- 本番運用時の確認手順とトラブルシュートを集約する。
- 各運用トピックへの入口ページとして、参照先を一元化する。

## 変更内容

- 2026-02-11: デプロイ/運用向けドキュメントの初期ページを作成。
- 2026-03-02: DB運用ドキュメントを `docs/deploy/db/` へ分離し、当ページを入口化。

## 目次

- DB運用:
  - `docs/deploy/db/README.md`（バックアップ/復元仕様、systemd timer、Alembic連携）

## 運用時の注意点

- `nginx` の `/api` リバプロ先と FastAPI の listen 設定を常に一致させる。
- 公開インターフェースは VPN/LAN 内に限定し、外部公開設定を避ける。
- 配布手順変更時はロールバック方法もあわせて更新する。

## 今後の追記候補

- 配布コマンド手順（dist 同期、サービス再起動）
- `wol-api.service` のユニット設定例
- 障害時チェックリスト（nginx/FastAPI/SQLite）
- バックアップ結果の通知（journal確認/外部通知）
