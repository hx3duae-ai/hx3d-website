-- CreateIndex
CREATE UNIQUE INDEX "ReplyDraft_linkId_key" ON "ReplyDraft"("linkId");

-- AddForeignKey
ALTER TABLE "ReplyDraft" ADD CONSTRAINT "ReplyDraft_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DownloadLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

