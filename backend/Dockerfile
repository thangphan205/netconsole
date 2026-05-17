FROM python:3.12-slim

WORKDIR /app/

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

# Copy poetry files
COPY ./pyproject.toml ./poetry.lock* /app/

# Install dependencies
ARG INSTALL_DEV=false
RUN bash -c "if [ $INSTALL_DEV == 'true' ] ; then poetry install --no-root ; else poetry install --no-root --only main ; fi"

ENV PYTHONPATH=/app

# Production start script (gunicorn + uvicorn workers)
RUN echo '#!/bin/bash\nexec gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:80 app.main:app' > /start.sh && chmod +x /start.sh

# Dev start script (uvicorn with reload)
RUN echo '#!/bin/bash\nexec uvicorn app.main:app --host 0.0.0.0 --port 80 --reload' > /start-reload.sh && chmod +x /start-reload.sh

COPY ./scripts/ /app/
COPY ./alembic.ini /app/
COPY ./prestart.sh /app/
COPY ./tests-start.sh /app/
COPY ./app /app/app

CMD ["/start.sh"]
