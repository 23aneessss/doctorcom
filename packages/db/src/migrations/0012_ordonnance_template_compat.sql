CREATE TABLE IF NOT EXISTS "ordonnance_pdf_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"nom" varchar(255) NOT NULL,
	"description" text,
	"chemin_fichier" text NOT NULL,
	"type_fichier" varchar(64) NOT NULL,
	"taille_fichier" integer NOT NULL,
	"page_width" integer DEFAULT 595 NOT NULL,
	"page_height" integer DEFAULT 842 NOT NULL,
	"layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"est_actif" boolean DEFAULT true NOT NULL,
	"is_default_for_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_chemin_fichier" text;
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_type_fichier" varchar(64);
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_taille_fichier" integer;
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "page_width" integer DEFAULT 595 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "page_height" integer DEFAULT 842 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordonnance_pdf_templates" ADD CONSTRAINT "ord_pdf_templates_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_pdf_templates_utilisateur_id_idx" ON "ordonnance_pdf_templates" USING btree ("utilisateur_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ord_pdf_templates_default_idx" ON "ordonnance_pdf_templates" USING btree ("utilisateur_id","is_default_for_user");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ai_provider" varchar(16) DEFAULT 'gemini' NOT NULL,
	"gemini_api_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
