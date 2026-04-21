CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

DO $$
BEGIN
  CREATE TYPE "public"."embedding_sync_operation" AS ENUM('upsert', 'delete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
  CREATE TYPE "public"."embedding_sync_status" AS ENUM('pending', 'processing', 'done', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "medicament_embeddings" (
	"medicament_id" integer PRIMARY KEY NOT NULL,
	"embedding" vector(3072) NOT NULL,
	"embedding_model" varchar(120) NOT NULL,
	"embedding_content_hash" varchar(128) NOT NULL,
	"embedding_payload_preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "medicament_embedding_outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"medicament_id" integer NOT NULL,
	"operation" "embedding_sync_operation" NOT NULL,
	"payload_hash" varchar(128),
	"status" "embedding_sync_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "medicament_embeddings"
    ADD CONSTRAINT "medicament_embeddings_medicament_id_medicaments_id_fk"
    FOREIGN KEY ("medicament_id")
    REFERENCES "public"."medicaments"("id")
    ON DELETE cascade
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "medicament_embedding_outbox_status_next_attempt_idx"
  ON "medicament_embedding_outbox" USING btree ("status", "next_attempt_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "medicament_embedding_outbox_medicament_idx"
  ON "medicament_embedding_outbox" USING btree ("medicament_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "medicament_embeddings_updated_at_idx"
  ON "medicament_embeddings" USING btree ("updated_at");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "medicament_embeddings_content_hash_idx"
  ON "medicament_embeddings" USING btree ("medicament_id", "embedding_content_hash");
