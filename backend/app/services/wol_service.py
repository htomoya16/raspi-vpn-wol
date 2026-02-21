from __future__ import annotations

import fcntl
import ipaddress
import socket
import struct

from app.repositories import pc_repository
from app.services.log_service import insert_log
from app.types import WolResult

SIOCGIFADDR = 0x8915
SIOCGIFBRDADDR = 0x8919
SIOCGIFNETMASK = 0x891B


def _parse_mac_address(mac_address: str) -> bytes:
    normalized = mac_address.replace(":", "").replace("-", "").lower()
    if len(normalized) != 12:
        raise ValueError("invalid mac address length")
    try:
        return bytes.fromhex(normalized)
    except ValueError as exc:
        raise ValueError("invalid mac address format") from exc


def _interface_exists(interface_name: str) -> bool:
    return any(name == interface_name for _, name in socket.if_nameindex())


def _ioctl_ipv4_address(interface_name: str, request: int) -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        ifreq = struct.pack("256s", interface_name.encode("utf-8"))
        response = fcntl.ioctl(sock.fileno(), request, ifreq)
    return socket.inet_ntoa(response[20:24])


def _get_interface_ipv4_config(interface_name: str) -> tuple[str, str, ipaddress.IPv4Network]:
    if len(interface_name) > 15:
        raise ValueError("send_interface must be 15 characters or less")
    if interface_name.lower().startswith("wg"):
        raise ValueError("wg interfaces are not allowed for WOL")
    if not _interface_exists(interface_name):
        raise ValueError(f"send interface not found: {interface_name}")

    try:
        address = _ioctl_ipv4_address(interface_name, SIOCGIFADDR)
        broadcast = _ioctl_ipv4_address(interface_name, SIOCGIFBRDADDR)
        netmask = _ioctl_ipv4_address(interface_name, SIOCGIFNETMASK)
    except OSError as exc:
        raise ValueError(f"failed to inspect interface: {interface_name}") from exc

    network = ipaddress.ip_network(f"{address}/{netmask}", strict=False)
    if not isinstance(network, ipaddress.IPv4Network):
        raise ValueError("only IPv4 networks are supported for WOL")
    return address, broadcast, network


def _send_magic_packet(
    mac_address: str,
    broadcast_ip: str,
    wol_port: int,
    source_ip: str,
) -> None:
    mac_bytes = _parse_mac_address(mac_address)
    packet = b"\xff" * 6 + mac_bytes * 16

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.bind((source_ip, 0))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(packet, (broadcast_ip, wol_port))


def send_wol(
    pc_id: str,
    broadcast_ip_override: str | None = None,
    wol_port_override: int | None = None,
) -> WolResult:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("pc_id is required")

    pc_row = pc_repository.get_pc_by_id(normalized_id)
    if pc_row is None:
        message = f"pc not found: {normalized_id}"
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message)

    mac_address = str(pc_row["mac_address"])
    send_interface = str(pc_row.get("send_interface") or "eth0")
    wol_port = wol_port_override if wol_port_override is not None else int(pc_row["wol_port"] or 9)
    if wol_port < 1 or wol_port > 65535:
        message = f"invalid wol_port for pc: {normalized_id}"
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message)

    try:
        interface_ip, interface_broadcast, interface_network = _get_interface_ipv4_config(send_interface)
    except ValueError as exc:
        message = str(exc)
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message) from exc

    broadcast_ip = broadcast_ip_override or str(pc_row["broadcast_ip"] or interface_broadcast)
    try:
        broadcast_addr = ipaddress.ip_address(broadcast_ip)
    except ValueError as exc:
        message = f"invalid broadcast_ip for pc: {normalized_id}"
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message) from exc
    if not isinstance(broadcast_addr, ipaddress.IPv4Address):
        message = "only IPv4 broadcast addresses are supported for WOL"
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message)

    pc_ip = pc_row.get("ip_address")
    if pc_ip:
        try:
            pc_ip_addr = ipaddress.ip_address(str(pc_ip))
        except ValueError as exc:
            message = f"invalid ip_address for pc: {normalized_id}"
            insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
            raise ValueError(message) from exc
        if not isinstance(pc_ip_addr, ipaddress.IPv4Address):
            message = "only IPv4 pc ip_address is supported for WOL"
            insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
            raise ValueError(message)
        if pc_ip_addr not in interface_network:
            message = (
                f"pc ip {pc_ip_addr} is outside interface network "
                f"{interface_network.with_prefixlen} ({send_interface})"
            )
            insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
            raise ValueError(message)

    try:
        _send_magic_packet(
            mac_address=mac_address,
            broadcast_ip=broadcast_ip,
            wol_port=wol_port,
            source_ip=interface_ip,
        )
    except (OSError, ValueError) as exc:
        message = f"failed to send WOL packet: {exc}"
        insert_log(action="wol", pc_id=normalized_id, status="failed", message=message)
        raise ValueError(message) from exc

    message = (
        f"WOL packet sent to pc={normalized_id} "
        f"(if={send_interface}, broadcast={broadcast_ip}, port={wol_port})"
    )

    insert_log(
        action="wol",
        pc_id=normalized_id,
        status="sent",
        message=message,
    )

    return {"message": message}
