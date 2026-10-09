-- CreateTable
CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL,
    "vkey" TEXT NOT NULL,
    "uid" TEXT,
    "userId" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Anonymous',
    "message" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_vkey_createdAt_idx" ON "Comment"("vkey", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_uid_createdAt_idx" ON "Comment"("uid", "createdAt");
