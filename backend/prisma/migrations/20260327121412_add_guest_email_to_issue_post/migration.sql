-- DropForeignKey
ALTER TABLE "IssuePost" DROP CONSTRAINT "IssuePost_reportedById_fkey";

-- AlterTable
ALTER TABLE "IssuePost" ADD COLUMN     "guestEmail" TEXT,
ALTER COLUMN "reportedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "IssuePost" ADD CONSTRAINT "IssuePost_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
