import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from app.core.db import engine
from app.crud.switches import update_switch_metadata
from app.models import Switch

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def sync_all_switches() -> None:
    logger.info("Scheduled sync: MAC/ARP/IP interfaces started")
    with Session(engine) as session:
        switches = session.exec(select(Switch)).all()
        for switch in switches:
            try:
                await asyncio.to_thread(
                    update_switch_metadata, session=session, switch_db=switch
                )
                logger.info("Synced %s", switch.hostname)
            except Exception as exc:
                logger.error("Sync failed for %s: %s", switch.hostname, exc)
    logger.info("Scheduled sync complete")


async def health_check_all_switches() -> None:
    from app.automation.health import check_switches_parallel

    logger.info("Scheduled health check started")
    with Session(engine) as session:
        switches = session.exec(select(Switch)).all()
        payload = [{"id": s.id, "ip": s.ipaddress, "port": s.port or 22} for s in switches]
        try:
            results = await asyncio.to_thread(check_switches_parallel, payload)
            for s in switches:
                if s.id is not None:
                    s.health_status = results.get(s.id, "DOWN")
                session.add(s)
            session.commit()
            logger.info("Health check complete: %s", results)
        except Exception as exc:
            logger.error("Health check failed: %s", exc)
    logger.info("Scheduled health check complete")
