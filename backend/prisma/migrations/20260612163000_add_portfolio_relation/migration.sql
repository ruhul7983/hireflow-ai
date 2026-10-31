-- AlterTable
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "heroDescription" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "heroHeading" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "heroImage" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "profDescription" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "profFeatures" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "profHeading" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "profImage" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "subServices" JSONB NOT NULL DEFAULT '[]';

-- UpdateExistingServices (Ensure slug is populated if any exist before setting NOT NULL)
UPDATE "Service" SET "slug" = LOWER(REPLACE("name", ' ', '-')) WHERE "slug" IS NULL;

-- AlterTableSlug
ALTER TABLE "Service" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "inclusions" JSONB NOT NULL DEFAULT '[]',
    "year" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_key" ON "Service"("slug");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
