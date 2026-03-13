# Deploy UFW Notes

## 目的

- Raspberry Pi 本番で、公開ポートを VPN 経由の最小範囲に制限する。
- SSH（22）と nginx（80）を LAN / VPN セグメントのみに限定する。

## 変更内容

- 2026-03-09: WireGuard 受信用UDPポート（`63088/udp`）の任意許可手順を追記。
- 2026-03-03: UFW 導入・適用手順を追加。
- 2026-03-03: `<LAN_CIDR>` 定義と LAN / VPN 併用手順を追記。
- 2026-03-03: 具体値（`192.168.10.0/24` / `wg0` / `10.6.0.0/24`）で実行手順を固定化。

## 前提

- 本手順は Raspberry Pi 側（SSH接続後）で実行する。
- 本ドキュメントは以下の値で運用する。
  - LAN: `192.168.10.0/24`
  - VPN IF: `wg0`
  - VPN: `10.6.0.0/24`

## 0. 値の確認

```bash
ip -br a
ip route
sudo wg show
ip -4 addr show dev wg0
```

- 期待結果:
  - LAN セグメント（`192.168.10.0/24`）が分かる
  - VPN インターフェース名（`wg0`）が分かる
  - VPN セグメント（`10.6.0.0/24`）が分かる

## 1. UFW インストール

```bash
sudo apt update
sudo apt install -y ufw
```

- 期待結果:
  - `ufw` コマンドが利用できる

## 2. 先に SSH を許可（切断防止）

```bash
sudo ufw allow from 192.168.10.0/24 to any port 22 proto tcp comment 'SSH from LAN'
sudo ufw allow in on wg0 from 10.6.0.0/24 to any port 22 proto tcp comment 'SSH from VPN'
```

- 期待結果:
  - SSH 22/TCP が LAN / VPN から許可される

## 3. デフォルト方針

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

- 期待結果:
  - 受信は拒否、送信は許可

## 4. LAN / VPN からの HTTP を許可

```bash
sudo ufw allow from 192.168.10.0/24 to any port 80 proto tcp comment 'HTTP from LAN'
sudo ufw allow in on wg0 from 10.6.0.0/24 to any port 80 proto tcp comment 'HTTP from VPN'
```

- 期待結果:
  - 80/TCP が LAN / VPN セグメント限定で許可される

## 5. 有効化と確認

```bash
sudo ufw --force enable
sudo ufw status numbered
```

- 期待結果:
  - `Status: active`
  - 22/80 許可ルールに `192.168.10.0/24` と `wg0` / `10.6.0.0/24` が表示される

## 6. （任意）WireGuard をこの端末で受ける場合

- Raspberry Pi を WireGuard サーバとして運用し、VPN クライアント接続を受ける場合のみ実施する。
- VPN接続のために、すでに `sudo ufw allow 63088/udp comment 'WireGuard'` を実行済みなら再実行は不要（`sudo ufw status numbered` でルールが存在することだけ確認する）。
- `63088` は本ドキュメントの運用例。実際は WireGuard 設定（`ListenPort`）のポート番号に置き換える。

```bash
sudo ufw allow 63088/udp comment 'WireGuard'
sudo ufw status numbered
```

- 期待結果:
  - `63088/udp` の許可ルールが表示される
  - WireGuard のハンドシェイク受信が可能になる

## 運用時の注意点

- `wol-api.service` は `127.0.0.1:8000` 待受のため、8000/TCP の公開は不要。
- 既存運用環境では `sudo ufw --force reset` は実施しない（ルール追加/削除で運用）。
- ルール変更中は SSH セッションを 1 本残し、切断事故を避ける。
- 誤設定で接続不能になった場合はローカルコンソールで `sudo ufw disable` して復旧する。
