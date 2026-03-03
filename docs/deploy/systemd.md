# Deploy systemd Notes

## 目的

- Raspberry Pi 本番で使う systemd ユニット運用を整理する。
- バックアップの自動実行と確認手順を標準化する。

## 変更内容

- 2026-03-03: systemd 運用ドキュメントを追加。
- 2026-03-03: バックアップ service/timer の導入手順を追加。
- 2026-03-03: `wol-api.service` の導入手順を追加。

## 対象ユニット

- `deploy/systemd/wol-api.service`
- `deploy/systemd/wol-db-backup.service`
- `deploy/systemd/wol-db-backup.timer`

## 反映手順（APIサービス）

```bash
sudo cp deploy/systemd/wol-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wol-api.service
sudo systemctl status wol-api.service --no-pager
```

- 期待結果:
  - `wol-api.service` が `active (running)` になる

## 反映手順（DBバックアップ）

```bash
sudo cp deploy/systemd/wol-db-backup.service /etc/systemd/system/
sudo cp deploy/systemd/wol-db-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wol-db-backup.timer
sudo systemctl status wol-db-backup.timer --no-pager
```

## 実行確認

```bash
sudo systemctl start wol-db-backup.service
sudo journalctl -u wol-db-backup.service -n 50 --no-pager
sudo systemctl list-timers --all | grep wol-db-backup
```

- 期待結果:
  - サービス手動実行が `success`
  - timer の次回実行時刻が表示される

## 運用時の注意点

- ユニットの `WorkingDirectory` と実際の配置先（例: `/opt/raspi-vpn-wol/backend`）を一致させる。
- `.venv` の Python パス変更時は `ExecStart` も更新する。
- timer 時刻を変更したら `daemon-reload` と再起動（`restart`）まで行う。
