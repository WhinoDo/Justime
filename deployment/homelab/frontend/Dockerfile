FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app

COPY --chown=appuser:appuser package.json package-lock.json ./
RUN npm ci

COPY --chown=appuser:appuser . .

RUN npm run build

USER appuser

EXPOSE 3000

CMD ["sh", "-lc", "npm run start -- -H 0.0.0.0 -p 3000"]
