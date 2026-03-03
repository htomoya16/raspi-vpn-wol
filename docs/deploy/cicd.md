# Deploy CI/CD Notes

## 目的

- CI/CD を自動化しつつ、VPN 前提の Raspberry Pi 運用と両立させる。
- Raspberry Pi 3 の性能制約を踏まえ、安定したデプロイ構成を明文化する。

## 変更内容

- 2026-03-03: CI/CD 運用方針（CI は GitHub Hosted、CD は self-hosted runner）を追加。
- 2026-03-03: Raspberry Pi 3 での運用指針（CD 専用 runner）を追記。

## 現在の CI

- `backend-ci.yml`
  - `pull_request` / `push`（`backend/**` 変更時）
  - `alembic upgrade head` + `pytest -q`
- `frontend-ci.yml`
  - `pull_request` / `push`（`frontend/**` 変更時）
  - `lint` / `typecheck` / `test` / `build`

## 推奨アーキテクチャ

- CI: GitHub Hosted Runner（`ubuntu-latest`）で実行する。
- CD: Raspberry Pi 上の `self-hosted runner` で実行する。
- 理由:
  - 自宅 VPN/LAN 内構成を維持しやすい
  - 外部公開 SSH を前提にしない
  - Pi 3 に重い CI 処理を寄せず、デプロイだけ担当させる

## Raspberry Pi 3 運用方針

- Pi 3 の runner は CD 専用にする。
- Pi 3 で実施する処理:
  - `git pull origin main`
  - `alembic upgrade head`
  - `systemctl restart wol-api.service`
  - `nginx reload`
- Pi 3 で避ける処理:
  - `npm ci` / フロントテスト一式 / 重いビルド

## 導入手順（段階的）

### 1. CI の必須チェック化

- GitHub branch rules で `Backend CI` / `Frontend CI` を required checks に設定する。

### 2. CD workflow は最初 `workflow_dispatch`

- いきなり `push main` 自動にせず、まず手動実行で安定性を確認する。
- 失敗時のロールバック手順は `docs/deploy/runbook.md` とあわせて運用する。

### 3. 安定後に `push main` 自動へ移行

- デプロイが安定したら `workflow_dispatch` + `push: branches: [main]` にする。
- 同時実行防止のため `concurrency` を設定する。

## デプロイ job の推奨構成

1. GitHub Hosted job
   - フロントビルド
   - `dist` を artifact 化
2. self-hosted (Pi) job
   - artifact 展開（`/var/www/wol`）
   - backend 更新と migration
   - systemd/nginx 再読込
   - `curl /api/health` で確認

## セキュリティ / 運用ガード

- GitHub Environments（例: `production`）で承認フローを付ける。
- `deploy` 前に DB バックアップを取る運用を維持する（`keep=30`）。
- 失敗時は workflow ログに `journalctl -u wol-api.service` を残す。

## 運用時の注意点

- self-hosted runner は Raspberry Pi 側のサービス監視対象に含める。
- runner 停止時は CD が止まるため、手動デプロイ手順を併記しておく。
