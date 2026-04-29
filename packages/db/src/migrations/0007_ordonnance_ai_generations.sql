DO $$ BEGIN
 CREATE TYPE "public"."ordonnance_ai_generation_status" AS ENUM('draft_ready', 'verifying', 'verified', 'verification_failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ordonnance_ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"suivi_id" uuid NOT NULL,
	"examen_id" uuid,
	"response_mode" varchar(32) NOT NULL,
	"status" "ordonnance_ai_generation_status" DEFAULT 'draft_ready' NOT NULL,
	"draft_result" jsonb NOT NULL,
	"verified_result" jsonb,
	"verification_error" text,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"verification_started_at" timestamp with time zone,
	"verification_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordonnance_ai_generations" ADD CONSTRAINT "ord_ai_generations_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordonnance_ai_generations" ADD CONSTRAINT "ord_ai_generations_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordonnance_ai_generations" ADD CONSTRAINT "ord_ai_generations_suivi_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivi"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_ai_generations_utilisateur_id_idx" ON "ordonnance_ai_generations" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_ai_generations_patient_id_idx" ON "ordonnance_ai_generations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_ai_generations_suivi_id_idx" ON "ordonnance_ai_generations" USING btree ("suivi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_ai_generations_status_idx" ON "ordonnance_ai_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_ai_generations_created_at_idx" ON "ordonnance_ai_generations" USING btree ("created_at");
