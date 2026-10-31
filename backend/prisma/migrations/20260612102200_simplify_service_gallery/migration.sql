-- DropTable
DROP TABLE IF EXISTS "Portfolio" CASCADE;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "gallery" JSONB NOT NULL DEFAULT '[]';
