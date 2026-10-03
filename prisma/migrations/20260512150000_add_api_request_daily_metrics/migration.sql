-- Lightweight aggregate API request metrics.
-- One row per day + external provider + endpoint + method + status code.
CREATE TABLE "ApiRequestDailyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRequestDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiRequestDailyMetric_date_provider_endpoint_method_statusCode_key"
    ON "ApiRequestDailyMetric"("date", "provider", "endpoint", "method", "statusCode");

CREATE INDEX "ApiRequestDailyMetric_date_idx"
    ON "ApiRequestDailyMetric"("date");

CREATE INDEX "ApiRequestDailyMetric_date_provider_idx"
    ON "ApiRequestDailyMetric"("date", "provider");

CREATE INDEX "ApiRequestDailyMetric_date_provider_endpoint_idx"
    ON "ApiRequestDailyMetric"("date", "provider", "endpoint");

CREATE INDEX "ApiRequestDailyMetric_date_statusCode_idx"
    ON "ApiRequestDailyMetric"("date", "statusCode");
