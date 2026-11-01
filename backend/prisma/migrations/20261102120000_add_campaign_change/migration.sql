-- CreateEnum
CREATE TYPE "CampaignChange" AS ENUM ('PAUSE', 'RESUME', 'STOP');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'CAMPAIGN_CHANGED';

-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'CAMPAIGN_CHANGE';

-- AlterEnum
ALTER TYPE "PendingActionType" ADD VALUE 'CHANGE_CAMPAIGN';

-- AlterTable
ALTER TABLE "PendingAction" ADD COLUMN     "campaignChange" "CampaignChange";
