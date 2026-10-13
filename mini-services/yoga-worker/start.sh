#!/bin/bash
# Optional self-host runner. Requires CRON_SECRET and WORKER_BASE_URL in the environment.
cd "$(dirname "$0")"
exec bun index.ts
