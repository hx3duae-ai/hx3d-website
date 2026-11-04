-- CreateTable
CREATE TABLE "ReplyDraft" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "senderRef" TEXT NOT NULL,
    "inboundText" TEXT NOT NULL,
    "inboundMid" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "fileId" TEXT,
    "draftText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "linkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,

    CONSTRAINT "ReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplyDraft_inboundMid_key" ON "ReplyDraft"("inboundMid");

-- CreateIndex
CREATE INDEX "ReplyDraft_status_createdAt_idx" ON "ReplyDraft"("status", "createdAt");
