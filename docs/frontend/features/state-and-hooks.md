# State and Hooks Feature

## 目的

- 画面状態管理の責務分割と、Hook間の依存関係を明確化する。

## 変更内容

- `useDashboardData` をオーケストレーターとして配置し、画面に必要な値と操作を集約。
- `useDashboardSse` を分離し、SSE受信処理（`pc_status` / `job`）を `useDashboardData` から独立。
- 状態を用途別に分離:
  - `usePcData`: PC領域の統合入口（下位フックの集約）
  - `usePcFilters`: PC絞り込み入力と適用状態
  - `usePcCollection`: PC一覧取得・ローカル状態・同期時刻
  - `usePcCrud`: 作成/更新/削除/状態確認の変異処理
  - `useLogsData`: ログ取得/削除
  - `useJobTracker`: 非同期ジョブ追跡
- SSE (`/api/events`) の `pc_status` / `job` イベントで画面状態を同期。
- WOL受付直後は `setPcStatusLocal` で対象PCを `booting` 表示へ即時反映し、体感遅延を抑制。
- `job` イベントは `succeeded/failed` の終端状態のみ再読込トリガーにし、`queued/running` での過剰再取得を抑制。
- `UptimePanel` の状態管理は `useUptimePanelState` を中心にしつつ、取得責務を以下に分離:
  - `useUptimeSummaryData`: オンライン集計の取得
  - `useUptimeTimelineData`: 稼働タイムラインの取得
  - `useSwipeNavigation`: スワイプ検知の共通化
- `components/uptime/utils.ts` に日付・範囲・表示補助ロジックを分離し、UI層の条件分岐を削減した。

## 運用時の注意点

- 新規機能追加時は、まず既存Hookの責務に収まるかを判断する。
- 収まらない場合は `useDashboardData` に直接肥大化させず、用途別Hookを追加する。
- SSE連携を追加する場合は `useDashboardSse` 側に閉じることを優先し、UIフックへ直接イベント処理を混在させない。
