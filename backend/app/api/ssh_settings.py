from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Response

from app.models.ssh_settings import (
    HostKeyCandidate, HostKeyConfirmation, PcSshSettingsResponse, PcSshSettingsUpdate,
)
from app.security.bearer_guard import require_authenticated_admin_token
from app.security.rate_limit import enforce_ssh_setup_rate_limit
from app.services import shutdown_service, ssh_settings_service
from app.services.ssh_settings_service import ShutdownUnavailableError

router = APIRouter(dependencies=[Depends(require_authenticated_admin_token)])
write_dependencies = [Depends(enforce_ssh_setup_rate_limit)]


def _run_settings_operation(operation: Callable[[], dict[str, object]]) -> dict[str, object]:
    """設定操作の例外を、画面向けのHTTPエラーへ変換する。

    Args:
        operation: 実行する固定の設定操作。

    Returns:
        設定操作の結果。

    Raises:
        HTTPException: PC未登録、設定不備、またはファイル操作に失敗した場合。
    """
    try:
        return operation()
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ShutdownUnavailableError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="SSH設定を保存できません。ラズパイの保存先と権限を確認してください") from exc


@router.get("/pcs/{pc_id}/ssh", response_model=PcSshSettingsResponse)
def get_pc_ssh_settings(pc_id: str, response: Response) -> dict[str, object]:
    """管理者向けにSSH設定を取得する。

    Args:
        pc_id: 対象PCのID。
        response: キャッシュ抑止を指定するHTTPレスポンス。

    Returns:
        公開鍵と設定状態。秘密鍵やファイルパスは含めない。
    """
    response.headers["Cache-Control"] = "no-store"
    return _run_settings_operation(lambda: ssh_settings_service.get_ssh_settings(pc_id))


@router.put("/pcs/{pc_id}/ssh", response_model=PcSshSettingsResponse, dependencies=write_dependencies)
def save_pc_ssh_settings(pc_id: str, payload: PcSshSettingsUpdate) -> dict[str, object]:
    """管理者が入力したSSH設定を保存する。

    Args:
        pc_id: 対象PCのID。
        payload: ユーザー名、ポート、有効設定。

    Returns:
        保存後の設定情報。
    """
    return _run_settings_operation(lambda: ssh_settings_service.save_ssh_settings(pc_id, payload))


@router.post("/pcs/{pc_id}/ssh/key", response_model=PcSshSettingsResponse, dependencies=write_dependencies)
def generate_pc_ssh_key(pc_id: str) -> dict[str, object]:
    """ラズパイ内にPC別の鍵を生成する。

    Args:
        pc_id: 対象PCのID。

    Returns:
        公開鍵とWindows登録コマンドを含む設定情報。
    """
    return _run_settings_operation(lambda: ssh_settings_service.generate_pc_ssh_key(pc_id))


@router.post("/pcs/{pc_id}/ssh/host-key/scan", response_model=HostKeyCandidate, dependencies=write_dependencies)
def scan_pc_host_key(pc_id: str) -> dict[str, object]:
    """対象PCのホスト鍵候補を取得する。

    Args:
        pc_id: 対象PCのID。

    Returns:
        まだ信頼していない公開鍵と指紋。
    """
    return _run_settings_operation(lambda: ssh_settings_service.scan_pc_host_key(pc_id))


@router.post("/pcs/{pc_id}/ssh/host-key", response_model=PcSshSettingsResponse, dependencies=write_dependencies)
def confirm_pc_host_key(pc_id: str, payload: HostKeyConfirmation) -> dict[str, object]:
    """PC側の指紋と照合したホスト鍵を登録する。

    Args:
        pc_id: 対象PCのID。
        payload: 候補鍵、PC側の指紋、取得時の設定情報。

    Returns:
        ホスト鍵確認後の設定情報。
    """
    return _run_settings_operation(lambda: ssh_settings_service.confirm_pc_host_key(pc_id, payload))


@router.post("/pcs/{pc_id}/ssh/test", response_model=PcSshSettingsResponse, dependencies=write_dependencies)
def test_pc_ssh_connection(pc_id: str) -> dict[str, object]:
    """停止命令を送らずに、SSH接続を確認する。

    Args:
        pc_id: 対象PCのID。

    Returns:
        接続確認後の設定情報。
    """
    return _run_settings_operation(lambda: shutdown_service.verify_pc_ssh_connection(pc_id))
