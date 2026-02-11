# Backend Notes

## 目的

- FastAPI の API 仕様、サービス層設計、例外処理方針を整理する。
- SQLite のテーブル設計とログ運用方針を記録する。

## 変更内容

- 2026-02-11: バックエンド向けドキュメントの初期ページを作成。
- 2026-02-11: FastAPI の最小 API 構成を追加（`/api/health` `/api/wol` `/api/status` `/api/logs`）。
- 2026-02-11: `db/database.py` に SQLite 初期化処理（`targets` `logs`）を追加。
- 2026-02-11: `repositories/` を追加し、ログ SQL を `log_repository.py` へ分離。
- 2026-02-11: API -> services -> repositories の呼び出し経路に統一。
- 今後は API 定義、DB スキーマ、運用時エラー対応を追記する。

## 運用時の注意点

- ルータ実装と `services/` の責務分離を維持する。
- 副作用 API（WOL送信）は入力検証とログ記録の仕様を明記する。
- ログ保持件数や削除ポリシー変更時は DB 運用ルールを更新する。

## 今後の追記候補

- `/api/wol` `/api/status` `/api/logs` の詳細 I/F
- エラーコード設計
- SQLite バックアップ/ローテーション方針
