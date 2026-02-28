# State and Hooks Feature

## 目的

- 画面状態管理の責務分割と、Hook間の依存関係を明確化する。

## 変更内容

- `useDashboardData` をオーケストレーターとして配置し、画面に必要な値と操作を集約。
- 状態を用途別に分離:
  - `usePcData`: PC一覧/作成/更新/削除/状態更新
  - `useLogsData`: ログ取得/削除
  - `useJobTracker`: 非同期ジョブ追跡
- SSE (`/api/events`) の `pc_status` / `job` イベントで画面状態を同期。
- WOL受付直後は `setPcStatusLocal` で対象PCを `booting` 表示へ即時反映し、体感遅延を抑制。
- `job` イベントは `succeeded/failed` の終端状態のみ再読込トリガーにし、`queued/running` での過剰再取得を抑制。
- `UptimePanel` の状態管理は `useUptimePanelState` へ集約し、画面側は描画中心にした。
- `components/uptime/utils.ts` に日付・範囲・表示補助ロジックを分離し、UI層の条件分岐を削減した。

## 運用時の注意点

- 新規機能追加時は、まず既存Hookの責務に収まるかを判断する。
- 収まらない場合は `useDashboardData` に直接肥大化させず、用途別Hookを追加する。
