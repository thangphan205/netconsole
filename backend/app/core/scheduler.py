import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from app.core.db import engine
from app.crud.devices import update_device_metadata
from app.models import Device

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def sync_all_devices() -> None:
    logger.info("Scheduled sync: MAC/ARP/IP interfaces started")
    with Session(engine) as session:
        devices = session.exec(select(Device)).all()
        for device in devices:
            try:
                await asyncio.to_thread(
                    update_device_metadata, session=session, device_db=device
                )
                logger.info("Synced %s", device.hostname)
            except Exception as exc:
                logger.error("Sync failed for %s: %s", device.hostname, exc)
    logger.info("Scheduled sync complete")


async def health_check_all_devices() -> None:
    from app.automation.health import check_devices_parallel

    logger.info("Scheduled health check started")
    with Session(engine) as session:
        devices = session.exec(select(Device)).all()
        payload = [
            {"id": s.id, "ip": s.ipaddress, "port": s.port or 22} for s in devices
        ]
        try:
            results = await asyncio.to_thread(check_devices_parallel, payload)
            for s in devices:
                if s.id is not None:
                    new_status = results.get(s.id, "DOWN")
                    if new_status == "UP" and s.health_status == "AUTH_ERROR":
                        new_status = "AUTH_ERROR"
                    s.health_status = new_status
                session.add(s)
            session.commit()
            logger.info("Health check complete: %s", results)
        except Exception as exc:
            logger.error("Health check failed: %s", exc)
    logger.info("Scheduled health check complete")
