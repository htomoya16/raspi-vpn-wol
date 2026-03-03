# Types and Models

## 目的

- `app/models/` と `app/types.py` の役割を分離して、実装の見通しをよくする。
- API境界と内部処理の型を混同しないためのルールを明文化する。

## 役割

- `app/models/`:
  - Pydantic (`BaseModel`) で API の入力/出力を定義する。
  - 実行時バリデーションを行う。
  - OpenAPI/Swagger UI に反映される。
- `app/types.py`:
  - `TypedDict` で内部データ構造（主に repository/service 間の dict）を定義する。
  - 静的型チェックと補完のために使う。
  - 実行時バリデーションは行わない。

## TypedDict 適用で実施した内容

- `dict[str, Any]` / `dict[str, str]` の戻り値を以下に置換。
- `PcRow`
- `LogRow`
- `JobRow`
- `WolResult`
- `PcStatusProbeResult`
- `PcDeletedResult`
- SQLiteの `Row` を辞書化する箇所は `cast(...)` で返却型を明示。
- API層は Pydantic モデルでレスポンス化するため、HTTPの挙動変更はない。

## 運用時の注意点

- 新しい API を追加するときは、外部I/Fを `models`、内部I/Fを `types.py` に分けて設計する。
- DBカラム追加時は `TypedDict` と Pydanticモデルの双方を更新する。
