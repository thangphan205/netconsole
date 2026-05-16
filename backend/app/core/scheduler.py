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
