-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "encryptedCredentials" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "frequencyCap" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executionId" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "asrTranscript" TEXT,
    "translatedText" TEXT,
    "ttsAudioKey" TEXT,
    "duration" INTEGER,
    "callMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_accounts_provider_status_idx" ON "integration_accounts"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_userId_provider_key" ON "integration_accounts"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_channel_key" ON "notification_preferences"("userId", "channel");

-- CreateIndex
CREATE INDEX "notification_deliveries_userId_status_idx" ON "notification_deliveries"("userId", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_idx" ON "notification_deliveries"("channel", "status");

-- CreateIndex
CREATE INDEX "voice_sessions_userId_status_idx" ON "voice_sessions"("userId", "status");

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

