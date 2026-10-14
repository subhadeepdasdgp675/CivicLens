-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('citizen', 'department', 'municipal');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('Pending', 'Ongoing', 'Resolved', 'Escalated');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('Garbage', 'Pothole', 'WaterOverflow', 'StreetLight', 'Drainage', 'Footpath', 'Other');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('info', 'success', 'warning', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'citizen',
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT,
    "departmentId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryType" "IssueCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuePost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "location" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'Pending',
    "image" TEXT NOT NULL,
    "reporters" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportedById" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "consolidatedTicketId" TEXT,

    CONSTRAINT "IssuePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidatedTicket" (
    "id" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'Pending',
    "escalationFlag" BOOLEAN NOT NULL DEFAULT false,
    "proofImage" TEXT,
    "resolutionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "ConsolidatedTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "isDepartmentUpdate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "issuePostId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "issueId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upvote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "issuePostId" TEXT NOT NULL,

    CONSTRAINT "Upvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_cityId_idx" ON "User"("cityId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE INDEX "Department_cityId_idx" ON "Department"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_cityId_categoryType_key" ON "Department"("cityId", "categoryType");

-- CreateIndex
CREATE INDEX "IssuePost_cityId_idx" ON "IssuePost"("cityId");

-- CreateIndex
CREATE INDEX "IssuePost_category_idx" ON "IssuePost"("category");

-- CreateIndex
CREATE INDEX "IssuePost_status_idx" ON "IssuePost"("status");

-- CreateIndex
CREATE INDEX "IssuePost_consolidatedTicketId_idx" ON "IssuePost"("consolidatedTicketId");

-- CreateIndex
CREATE INDEX "IssuePost_reportedById_idx" ON "IssuePost"("reportedById");

-- CreateIndex
CREATE INDEX "IssuePost_lat_lng_idx" ON "IssuePost"("lat", "lng");

-- CreateIndex
CREATE INDEX "IssuePost_cityId_category_status_idx" ON "IssuePost"("cityId", "category", "status");

-- CreateIndex
CREATE INDEX "IssuePost_cityId_status_createdAt_idx" ON "IssuePost"("cityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IssuePost_cityId_category_createdAt_idx" ON "IssuePost"("cityId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "IssuePost_reportedById_status_idx" ON "IssuePost"("reportedById", "status");

-- CreateIndex
CREATE INDEX "IssuePost_reportedById_createdAt_idx" ON "IssuePost"("reportedById", "createdAt");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_departmentId_idx" ON "ConsolidatedTicket"("departmentId");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_cityId_idx" ON "ConsolidatedTicket"("cityId");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_status_idx" ON "ConsolidatedTicket"("status");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_escalationFlag_idx" ON "ConsolidatedTicket"("escalationFlag");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_departmentId_cityId_idx" ON "ConsolidatedTicket"("departmentId", "cityId");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_departmentId_status_idx" ON "ConsolidatedTicket"("departmentId", "status");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_cityId_status_idx" ON "ConsolidatedTicket"("cityId", "status");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_departmentId_cityId_status_idx" ON "ConsolidatedTicket"("departmentId", "cityId", "status");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_status_escalationFlag_createdAt_idx" ON "ConsolidatedTicket"("status", "escalationFlag", "createdAt");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_departmentId_status_resolvedAt_idx" ON "ConsolidatedTicket"("departmentId", "status", "resolvedAt");

-- CreateIndex
CREATE INDEX "ConsolidatedTicket_cityId_status_resolvedAt_idx" ON "ConsolidatedTicket"("cityId", "status", "resolvedAt");

-- CreateIndex
CREATE INDEX "Comment_issuePostId_idx" ON "Comment"("issuePostId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "Upvote_userId_issuePostId_key" ON "Upvote"("userId", "issuePostId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuePost" ADD CONSTRAINT "IssuePost_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuePost" ADD CONSTRAINT "IssuePost_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuePost" ADD CONSTRAINT "IssuePost_consolidatedTicketId_fkey" FOREIGN KEY ("consolidatedTicketId") REFERENCES "ConsolidatedTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedTicket" ADD CONSTRAINT "ConsolidatedTicket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedTicket" ADD CONSTRAINT "ConsolidatedTicket_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issuePostId_fkey" FOREIGN KEY ("issuePostId") REFERENCES "IssuePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_issuePostId_fkey" FOREIGN KEY ("issuePostId") REFERENCES "IssuePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
