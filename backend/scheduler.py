from apscheduler.schedulers.asyncio import AsyncIOScheduler
from cleanup import cleanup_old_files, cleanup_orphaned_db_records, get_storage_usage
import logging

logger = logging.getLogger("splice.cleanup")


def setup_cleanup_scheduler(app):
    scheduler = AsyncIOScheduler()

    @scheduler.scheduled_job("interval", hours=6)
    def scheduled_cleanup():
        result = cleanup_old_files(max_age_hours=72)
        cleaned = cleanup_orphaned_db_records()
        storage = get_storage_usage()
        logger.info(
            f"Cleanup: removed {result['removed']} files, "
            f"cleaned {cleaned['cleaned']} orphaned db records, "
            f"storage: {storage['total_mb']}MB"
        )

    scheduler.start()
    logger.info("Cleanup scheduler started")

    @app.on_event("shutdown")
    def shutdown():
        scheduler.shutdown()
