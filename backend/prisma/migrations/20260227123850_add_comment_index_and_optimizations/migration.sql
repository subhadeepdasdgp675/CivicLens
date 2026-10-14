-- CreateIndex
CREATE INDEX "Comment_issuePostId_createdAt_idx" ON "Comment"("issuePostId", "createdAt");
