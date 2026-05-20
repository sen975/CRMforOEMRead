-- CreateEnum
CREATE TYPE "WebsitePageType" AS ENUM ('HOME', 'PRODUCT_LIST', 'PRODUCT_DETAIL', 'BRAND', 'ABOUT', 'CONTACT', 'SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResearchReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "research_reports" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "searchEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceEvidence" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ResearchReportStatus" NOT NULL DEFAULT 'QUEUED',
ALTER COLUMN "reportJson" DROP NOT NULL,
ALTER COLUMN "finalMarkdown" DROP NOT NULL;

-- AlterTable
ALTER TABLE "website_analyses" ADD COLUMN     "pricePositioning" TEXT,
ADD COLUMN     "websiteCompleteness" INTEGER;

-- CreateTable
CREATE TABLE "website_analysis_pages" (
    "id" TEXT NOT NULL,
    "websiteAnalysisId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageType" "WebsitePageType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "language" TEXT,
    "textSummary" TEXT,
    "headings" JSONB,
    "links" JSONB,
    "images" JSONB,
    "contacts" JSONB,
    "priceSignals" JSONB,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_analysis_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_analysis_products" (
    "id" TEXT NOT NULL,
    "websiteAnalysisId" TEXT NOT NULL,
    "sourcePageId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceSignals" JSONB,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_analysis_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_analysis_pages_websiteAnalysisId_pageType_idx" ON "website_analysis_pages"("websiteAnalysisId", "pageType");

-- CreateIndex
CREATE INDEX "website_analysis_pages_url_idx" ON "website_analysis_pages"("url");

-- CreateIndex
CREATE INDEX "website_analysis_products_websiteAnalysisId_idx" ON "website_analysis_products"("websiteAnalysisId");

-- CreateIndex
CREATE INDEX "website_analysis_products_category_idx" ON "website_analysis_products"("category");

-- AddForeignKey
ALTER TABLE "website_analysis_pages" ADD CONSTRAINT "website_analysis_pages_websiteAnalysisId_fkey" FOREIGN KEY ("websiteAnalysisId") REFERENCES "website_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_analysis_products" ADD CONSTRAINT "website_analysis_products_websiteAnalysisId_fkey" FOREIGN KEY ("websiteAnalysisId") REFERENCES "website_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
