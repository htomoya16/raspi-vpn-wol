# Theme System

## 目的

- テーマ適用ロジック（色計算・default分岐・UI変数反映）を分離し、保守性を高める。

## 変更内容

- テーマ設定の定数を `frontend/src/theme/theme-options.ts` に集約。
  - `THEME_OPTIONS`
  - `DEFAULT_THEME_ID`
  - `DEFAULT_APPEARANCE_MODE`
  - `THEME_STORAGE_KEY`
  - `APPEARANCE_STORAGE_KEY`
- テーマ適用ロジックを分割。
  - `frontend/src/theme/app-theme.ts`: オーケストレータ（テーマ判定と適用順序）
  - `frontend/src/theme/default-theme.ts`: `default` テーマの dark/light 変数適用
  - `frontend/src/theme/palette-theme.ts`: カラーテーマの dark/light 変数適用
  - `frontend/src/theme/color-utils.ts`: `mixHex` / `toRgba` など色計算ユーティリティ
  - `frontend/src/theme/types.ts`: `EffectiveAppearanceMode` 型定義
- `App.tsx` はテーマ変数の直接計算をやめ、`applyAppTheme()` 呼び出しと保存処理に集中させた。
- `frontend/src/hooks/useThemeSettings.ts` を追加し、以下を集約した。
  - `localStorage` 読み書き（`wol:theme-color` / `wol:appearance-mode`）
  - `system` 外観時の実効モード解決（`prefers-color-scheme`）
  - `applyAppTheme()` の適用
- テーマトークンに `--floating-switch-shadow` / `--floating-switch-shadow-hover` を追加し、ページ移動ボタンの影色をテーマ連動にした。
- 設定画面の `デフォルト` スウォッチは、実効外観に応じて白黒の単色表示にした（dark: 黒系 / light: 白系）。

## 運用時の注意点

- 新しいテーマを追加する場合は `theme-options.ts` のみ更新すればよい。
- `default` テーマの配色調整は `default-theme.ts`、カラー系の計算調整は `palette-theme.ts` に限定して変更する。
- テーマ関連の状態追加は `App.tsx` ではなく `useThemeSettings.ts` 側へ寄せる。
- テーマ変更時の回帰確認は `npm run lint` / `npm run typecheck` / `npm run test` をセットで実施する。
