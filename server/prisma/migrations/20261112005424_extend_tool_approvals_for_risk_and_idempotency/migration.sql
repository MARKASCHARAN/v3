-- AlterTable
ALTER TABLE "ai_tool_approvals" ADD COLUMN     "agentRole" TEXT NOT NULL DEFAULT 'MAIN_ORCHESTRATOR',
ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'INTERNAL_WRITE';

-- CreateIndex
CREATE UNIQUE INDEX "ai_tool_approvals_idempotencyKey_key" ON "ai_tool_approvals"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ai_tool_approvals_executionId_status_idx" ON "ai_tool_approvals"("executionId", "status");

-- CreateIndex
CREATE INDEX "ai_tool_approvals_expiresAt_idx" ON "ai_tool_approvals"("expiresAt");
