-- CreateTable
CREATE TABLE IF NOT EXISTS "SearchLog" (
    "query" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("query")
);
