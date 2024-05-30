from fastapi import APIRouter, Response
from pathlib import Path
from app.api.deps import CurrentUser, SessionDep
from app.models import LogsPublic

router = APIRouter()

LOG_FILE = "app.log"


@router.get("/", response_model=LogsPublic)
async def read_logs(
    session: SessionDep,
    current_user: CurrentUser,
):
    try:
        log_file = Path(LOG_FILE)
        if log_file.exists():
            with open(log_file, "r") as f:
                lines = f.readlines()
                list_logs = []
                i = 0
                for line in reversed(lines[-100:]):
                    line = line.strip().split(" - ")
                    if len(line) == 5:
                        list_logs.append(
                            {
                                "id": i,
                                "datetime": line[0],
                                "severity": line[1],
                                "username": line[2],
                                "client_ip": line[3],
                                "message": line[4],
                            }
                        )
                    else:
                        list_logs.append(
                            {
                                "id": i,
                                "datetime": line[0],
                                "severity": line[1],
                                "username": "n/a",
                                "client_ip": "n/a",
                                "message": line[2],
                            }
                        )
                    i += 1
                return {"data": list_logs, "count": len(list_logs)}
        else:
            return {"error": f"Log file '{LOG_FILE}' does not exist."}
    except Exception as e:
        return {"error": str(e)}
