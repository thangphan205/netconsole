FROM python:3.13-slim

WORKDIR /app/

# Install Poetry via pip — increased timeout to prevent transient PyPI read timeouts
RUN pip install --default-timeout=100 --no-cache-dir "poetry==2.4.1" && \
    poetry config virtualenvs.create false

# Copy poetry files
COPY ./pyproject.toml ./poetry.lock* /app/

# Install dependencies (regenerate lock if stale)
ARG INSTALL_DEV=false
RUN poetry check --lock 2>/dev/null || poetry lock && \
    bash -c "if [ $INSTALL_DEV == 'true' ] ; then poetry install --no-root ; else poetry install --no-root --only main ; fi"

ENV PYTHONPATH=/app

# Production start script (runs migrations then gunicorn)
RUN printf '#!/bin/bash\nbash /app/prestart.sh\nexec gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:80 app.main:app\n' > /start.sh && chmod +x /start.sh

# Dev start script (runs migrations then uvicorn with reload)
RUN printf '#!/bin/bash\nbash /app/prestart.sh\nexec uvicorn app.main:app --host 0.0.0.0 --port 80 --reload\n' > /start-reload.sh && chmod +x /start-reload.sh

COPY ./scripts/ /app/
COPY ./alembic.ini /app/
COPY ./prestart.sh /app/
COPY ./tests-start.sh /app/
COPY ./app /app/app

CMD ["/start.sh"]
