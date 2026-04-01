ALTER TYPE "public"."rendez_vous_statut" ADD VALUE IF NOT EXISTS 'bloque';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"session_notes" text,
	"mood" varchar(32),
	"focus_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"title" varchar(255),
	"content" text NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN IF NOT EXISTS "tension_arterielle" varchar(32);--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN IF NOT EXISTS "frequence_cardiaque" integer;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN IF NOT EXISTS "temperature" numeric;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN IF NOT EXISTS "spo2" numeric;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN IF NOT EXISTS "imc" numeric;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "heure_fin" varchar(16);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "type_creneau" varchar(64);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "patient_label" varchar(255);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "patient_initials" varchar(16);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "couleur" varchar(32);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "titre" varchar(64);--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "specialite" varchar(255);--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "avatar_url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flow_sessions" ADD CONSTRAINT "flow_sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_notes" ADD CONSTRAINT "memory_notes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_tags" ADD CONSTRAINT "memory_tags_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flow_sessions_utilisateur_id_idx" ON "flow_sessions" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flow_sessions_started_at_idx" ON "flow_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_notes_utilisateur_id_idx" ON "memory_notes" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_notes_updated_at_idx" ON "memory_notes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_tags_utilisateur_id_idx" ON "memory_tags" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memory_tags_utilisateur_name_unique" ON "memory_tags" USING btree ("utilisateur_id","name");
