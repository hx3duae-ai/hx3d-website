-- CreateTable
CREATE TABLE "DeliverableFile" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "description" TEXT,
    "storageName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeliverableFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "recipient" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxDownloads" INTEGER NOT NULL DEFAULT 1,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadEvent" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliverableFile_keyword_key" ON "DeliverableFile"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverableFile_storageName_key" ON "DeliverableFile"("storageName");

-- CreateIndex
CREATE UNIQUE INDEX "DownloadLink_tokenHash_key" ON "DownloadLink"("tokenHash");

-- CreateIndex
CREATE INDEX "DownloadLink_fileId_idx" ON "DownloadLink"("fileId");

-- CreateIndex
CREATE INDEX "DownloadEvent_linkId_idx" ON "DownloadEvent"("linkId");

-- AddForeignKey
ALTER TABLE "DownloadLink" ADD CONSTRAINT "DownloadLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DeliverableFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadEvent" ADD CONSTRAINT "DownloadEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DownloadLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
