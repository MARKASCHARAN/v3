-- CreateTable
CREATE TABLE "ai_executions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT 'default',
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "provider" TEXT,
    "model" TEXT,
    "responseText" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "stepsData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_approvals" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolArgs" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultData" JSONB,
    "errorMessage" TEXT,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tool_approvals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_approvals" ADD CONSTRAINT "ai_tool_approvals_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_approvals" ADD CONSTRAINT "ai_tool_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
