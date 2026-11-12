ALTER TABLE "ai_executions" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "timeoutAt" TIMESTAMP(3);

CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executionId" TEXT,
    "domainEventId" TEXT,
    "jobType" TEXT NOT NULL,
    "externalJobId" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB,
    "resultData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_events_idempotencyKey_key" ON "domain_events"("idempotencyKey");

CREATE INDEX "domain_events_userId_status_idx" ON "domain_events"("userId", "status");

CREATE INDEX "domain_events_eventType_status_idx" ON "domain_events"("eventType", "status");

CREATE UNIQUE INDEX "background_jobs_idempotencyKey_key" ON "background_jobs"("idempotencyKey");

CREATE INDEX "background_jobs_userId_status_idx" ON "background_jobs"("userId", "status");

CREATE INDEX "background_jobs_status_scheduledFor_idx" ON "background_jobs"("status", "scheduledFor");

CREATE INDEX "background_jobs_jobType_status_idx" ON "background_jobs"("jobType", "status");

CREATE UNIQUE INDEX "ai_executions_idempotencyKey_key" ON "ai_executions"("idempotencyKey");

ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "domain_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

