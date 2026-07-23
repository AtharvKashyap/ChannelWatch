CREATE TABLE "rate_limit_counters" (
	"scope" text NOT NULL,
	"bucket_key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_scope_bucket_key_window_start_pk" PRIMARY KEY("scope","bucket_key","window_start")
);
--> statement-breakpoint
CREATE TABLE "request_metrics" (
	"metric" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "request_metrics_metric_window_start_pk" PRIMARY KEY("metric","window_start")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_counters_expires_at_idx" ON "rate_limit_counters" USING btree ("expires_at");