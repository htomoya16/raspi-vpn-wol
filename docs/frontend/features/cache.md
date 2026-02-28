# Cache Feature

## 目的

- API呼び出し回数を減らし、体感表示速度を改善する。
- ロード中のレイアウト崩れを抑えつつ、最新データへの追従性を維持する。

## 変更内容

- フロントキャッシュは「メモリキャッシュ + 再検証」で設計する。
- フロントキャッシュは `src/api/cache.ts`（in-memory）と `requestCached` で実装する。
- キャッシュキー接頭辞とTTLは `src/api/cache-policy.ts` に集約する。
- 基本方針:
  - `GET` のみキャッシュ対象。
  - `POST/PATCH/DELETE` はキャッシュしない。
  - 変異系成功時は関連キーを即 invalidate する。
  - 画面は stale-while-revalidate（先にキャッシュ表示し、裏で再取得）を採用する。

### クエリキー設計（実装値）

- prefix:
  - `pcs:list:`
  - `uptime:summary:`
  - `uptime:weekly:`
  - `logs:list:`
- 実キー生成:
  - `listPcs`:
    - `pcs:list:${query}`
    - 例: `pcs:list:?status=online&limit=200`
  - `getPcUptimeSummary`:
    - `uptime:summary:pc=${encodeURIComponent(pcId)}:${query}`
    - 例: `uptime:summary:pc=pc-main:?from=2026-02-01&to=2026-02-28&bucket=week&tz=Asia%2FTokyo`
  - `getPcWeeklyTimeline`:
    - `uptime:weekly:pc=${encodeURIComponent(pcId)}:${query}`
  - `listLogs`:
    - `logs:list:${query}`
    - 例: `logs:list:?limit=50&pc_id=pc-main&ok=true`

### TTL設計（実装値）

- PC一覧: `30s`
- 稼働集計（summary）: `120s`
- 稼働タイムライン（weekly）: `120s`
- ログ: `10s`

### TTLの目安（一般論）

- 頻繁に変わる一覧・状態: `5s〜30s`
- 集計系（更新頻度が低い）: `60s〜300s`
- ユーザー操作直後の整合性を重視する画面:
  - TTLを短くするか、更新成功後に prefix invalidate を必ず行う

### 無効化ルール（実装値）

- PC作成/更新/削除後:
  - `pcs:list:*`
  - `uptime:summary:pc={pc_id}:*`
  - `uptime:weekly:pc={pc_id}:*`
  - `logs:list:*`
- WOL送信後:
  - `pcs:list:*`
  - `uptime:summary:pc={pc_id}:*`
  - `uptime:weekly:pc={pc_id}:*`
  - `logs:list:*`
- SSEイベント受信時:
  - `pc_status`: `pcs:list:*` + 該当PCの `uptime:summary:pc={pc_id}:*` / `uptime:weekly:pc={pc_id}:*` + `logs:list:*`
  - `job`: `payload.pc_id` があれば該当PCのみ、なければ全体 (`uptime:summary:*` / `uptime:weekly:*`) を無効化 + `logs:list:*`

### 参照コード

- キー/TTL定義: `frontend/src/api/cache-policy.ts`
- キャッシュ本体（Map + TTL + in-flight）: `frontend/src/api/cache.ts`
- 共通実行（requestCached）: `frontend/src/api/http.ts`
- 変異時invalidate: `frontend/src/api/pcs.ts`, `frontend/src/api/logs.ts`
- SSE時invalidate: `frontend/src/hooks/useDashboardData.ts`
- HTTPクライアント: `frontend/src/api/http.ts` で `fetch(..., { cache: 'no-store' })` を既定化し、ブラウザHTTPキャッシュによる古い一覧復元を防止

### フロント実装内容（2026-02-27）

1. `src/api/cache.ts` を追加して `get/set/invalidate/invalidateByPrefix` を実装した。
2. `src/api/http.ts` に `requestCached`（キー + TTL + stale-while-revalidate）を追加した。
3. `src/api/pcs.ts` / `src/api/logs.ts` の `GET` を `requestCached` 化した。
4. 変異系API成功時に prefix invalidate を呼ぶようにした。
5. SSE受信時（`pc_status` / `job`）に `pcs/uptime/logs` のprefix invalidateを行うようにした。
6. `src/api/http.test.ts` / `src/api/pcs.test.ts` / `src/api/logs.test.ts` でキャッシュ挙動とinvalidateを検証する。
7. `src/hooks/useDashboardData.test.tsx` で SSE (`pc_status` / `job`) 受信時の invalidate + 再読込を検証する。
8. `src/api/cache-flow.test.ts` で「一覧表示 → 更新系API → invalidate → 再取得」の回帰を検証する。

## 運用時の注意点

- キャッシュはメモリのみで、ページリロード時は消える設計にする（学習・デバッグを簡単にするため）。
- ロード表示は既存データを維持したまま、オーバーレイ `・・・` を重ねる。
- モバイルのスワイプ画面では、前回データを残しつつ再検証することで視覚的なチラつきを抑える。
- 開発時にキャッシュログを見たい場合はブラウザコンソールで `localStorage.setItem('wol:cache-debug', '1')` を設定する。
  - 無効化は `localStorage.removeItem('wol:cache-debug')`。
  - 本番ビルドでは `import.meta.env.DEV` が `false` のためログは出ない。

## 確認手順（開発時）

1. 同一条件で同じ一覧を短時間に連続で開く。
2. `Network` で同一GETが毎回発生しないことを確認する（cache hit）。
3. PC作成/更新/削除/WOL送信を実行する。
4. 次の一覧再取得で新しい通信が発生し、変更結果が反映されることを確認する（prefix invalidate）。
5. SSE `pc_status` / `job` イベント発生時に、表示更新とログ再取得が走ることを確認する。
