from typing import Any

import httpx

from .config import settings


class NetconsoleAPIError(Exception):
    pass


class NetconsoleClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.api_url,
            headers={"X-API-Key": settings.api_key},
            timeout=settings.timeout_seconds,
            verify=settings.verify_ssl,
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        resp = await self._client.request(method, path, **kwargs)
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", resp.text)
            except ValueError:
                detail = resp.text
            raise NetconsoleAPIError(f"NetConsole API {resp.status_code}: {detail}")
        if not resp.content:
            return None
        return resp.json()

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=_drop_none(params))

    async def post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._request("POST", path, json=_drop_none(json))

    async def put(
        self,
        path: str,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        return await self._request(
            "PUT", path, json=_drop_none(json), params=_drop_none(params)
        )

    async def delete(self, path: str) -> Any:
        return await self._request("DELETE", path)


def _drop_none(d: dict[str, Any] | None) -> dict[str, Any] | None:
    if d is None:
        return None
    return {k: v for k, v in d.items() if v is not None}


client = NetconsoleClient()
