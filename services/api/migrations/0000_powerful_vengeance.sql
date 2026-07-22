CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" text NOT NULL,
	"handle" text,
	"display_name" text NOT NULL,
	"description" text,
	"channel_url" text,
	"country_code" text,
	"thumbnail_url" text,
	"subscriber_range" text,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"research_status" text,
	"published_classification" text,
	"classification_confidence" numeric,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"claim_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"support_type" text,
	"quoted_excerpt" text,
	"locator" text,
	CONSTRAINT "claim_sources_claim_id_source_id_pk" PRIMARY KEY("claim_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"object_type" text,
	"object_id" uuid,
	"literal_value" jsonb,
	"confidence" numeric,
	"claim_status" text,
	"effective_date" date,
	"expiration_date" date,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"claim_id" uuid,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_relationship" text,
	"explanation" text,
	"status" text,
	"submitted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"canonical_name" text NOT NULL,
	"legal_name" text,
	"jurisdiction" text,
	"registry_identifier" text,
	"website" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"alias" text NOT NULL,
	"alias_type" text,
	"source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_entity_id" uuid,
	"subject_channel_id" uuid,
	"relationship_type" text NOT NULL,
	"object_entity_id" uuid,
	"object_channel_id" uuid,
	"ownership_percentage" numeric,
	"control_level" text,
	"effective_from" date,
	"effective_to" date,
	"confidence" numeric,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "reviewers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid,
	"reviewer_id" uuid,
	"decision" text,
	"reasoning" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"publisher" text,
	"author" text,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone,
	"source_tier" integer,
	"source_type" text,
	"archive_url" text,
	"content_hash" text,
	"status" text
);
--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_subject_entity_id_entities_id_fk" FOREIGN KEY ("subject_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_subject_channel_id_channels_id_fk" FOREIGN KEY ("subject_channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_object_entity_id_entities_id_fk" FOREIGN KEY ("object_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_object_channel_id_channels_id_fk" FOREIGN KEY ("object_channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_object_id_idx" ON "audit_events" USING btree ("object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_youtube_channel_id_key" ON "channels" USING btree ("youtube_channel_id");--> statement-breakpoint
CREATE INDEX "claims_subject_id_idx" ON "claims" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "relationships_subject_channel_id_idx" ON "relationships" USING btree ("subject_channel_id");--> statement-breakpoint
CREATE INDEX "relationships_object_entity_id_idx" ON "relationships" USING btree ("object_entity_id");