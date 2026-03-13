# APIトークン運用（break-glass / CLI）

## 目的

- APIトークンを紛失した場合でも、Raspberry Pi 上で管理者トークンを再発行できるようにする。
- `backend/scripts/create_api_token.py` を使った break-glass 手順を定義する。

## 変更内容

- 2026-03-03: break-glass 用 CLI トークン発行手順を追加。

## 対象CLI

- `backend/scripts/create_api_token.py`
  - DBへ直接トークンを作成する運用用 CLI。
  - 主な用途:
    - admin トークン喪失時の復旧
    - 初回運用で UI から発行できない状況の解除

## 実行手順（Raspberry Pi / SSH接続後）

```bash
cd /opt/raspi-vpn-wol/backend
source .venv/bin/activate
python scripts/create_api_token.py --role admin --name break-glass-admin
```

- 期待結果:
  - `id=...` / `name=...` / `role=admin` / `token_prefix=...` / `plain_token=...` が表示される。
  - `plain_token` はこの表示時のみ取得できるため、即時に安全な場所へ保管する。

### 有効期限付きで発行する場合

```bash
cd /opt/raspi-vpn-wol/backend
source .venv/bin/activate
python scripts/create_api_token.py --role admin --name break-glass-admin --expires-at 2026-04-30T23:59:59+09:00
```

- 期待結果:
  - `expires_at=...` に指定日時が表示される。

## 動作確認

```bash
curl -s http://127.0.0.1/api/auth/me -H "Authorization: Bearer <発行したplain_token>"
```

- 期待結果:
  - `role: "admin"` を含むJSONが返る。

## 復旧後の推奨対応

1. UIの APIトークン管理で通常運用用トークンを発行する。
2. 不要な古いトークンを失効（必要なら削除）する。
3. 操作ログに不審な利用がないか確認する。

## 運用時の注意点

- CLI は DB に直接書き込むため、実行端末は Raspberry Pi 本体（または同等権限の運用端末）に限定する。
- `plain_token` は再表示できない。チャットや平文メモへの貼り付けは避ける。
- 長期常用の管理者トークンとして break-glass トークンを使い続けない。
