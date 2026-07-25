import socket
from concurrent.futures import ThreadPoolExecutor, as_completed


def _tcp_check(ip: str, port: int, timeout: float = 3.0) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def check_device(ip: str, port: int) -> str:
    return "UP" if _tcp_check(ip, port or 22) else "DOWN"


def check_devices_parallel(devices: list[dict]) -> dict[int, str]:
    """Returns {device_id: 'UP'|'DOWN'} for all devices concurrently."""
    results: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {
            pool.submit(_tcp_check, s["ip"], s["port"] or 22): s["id"] for s in devices
        }
        for future in as_completed(futures):
            sid = futures[future]
            results[sid] = "UP" if future.result() else "DOWN"
    return results
