# Deploy Runbook

## 目的

- 日常運用と障害対応の最小手順を 1 ページに集約する。
- 本番運用前の Go/No-Go 判断を再現可能にする。

## 変更内容

- 2026-03-03: 運用ランブックを追加。
- 2026-03-03: 起動確認、障害時初動、復旧後確認のチェックリストを追加。

## 運用開始前チェック

1. Frontend/Backend のテスト通過を確認する。
2. nginx 設定反映と `/api/health` 応答を確認する。
3. DB バックアップの手動実行とファイル生成を確認する。
4. API トークン（admin/device）で画面操作を確認する。
5. 外部公開されていない（VPN/LAN 内のみ）ことを確認する。

## 日常確認（定期）

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status wol-db-backup.timer --no-pager
sudo journalctl -u wol-db-backup.service -n 50 --no-pager
```

- 異常の目安:
  - nginx が `active (running)` でない
  - バックアップ service が連続失敗
  - backup ファイル世代が増えない

## 障害時初動

1. まず現行 DB を退避する（上書き前に必須）。
2. 直近バックアップから `app.db` を復元する。
3. `alembic upgrade head` でスキーマ整合を取る。
4. API サービス再起動後に `/api/health` を確認する。
5. adminトークン喪失時は `docs/deploy/token-ops.md` の break-glass 手順で復旧する。

## 復旧後確認

- PC 一覧取得が成功する。
- `POST /api/pcs/status/refresh` が成功する。
- 操作ログに復旧後イベントが記録される。
- 次回バックアップが通常どおり実行される。

## 運用時の注意点

- 復元時は「復元前 DB」の退避を省略しない。
- トークン失効/削除運用を実施し、不要トークンを放置しない。
- 仕様変更（nginx/systemd/DB運用）は同時に `docs/deploy/*` を更新する。
