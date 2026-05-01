CREATE TABLE IF NOT EXISTS "ordonnance_pdf_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"nom" varchar(255) NOT NULL,
	"description" text,
	"chemin_fichier" text NOT NULL,
	"type_fichier" varchar(64) NOT NULL,
	"taille_fichier" integer NOT NULL,
	"page_width" integer NOT NULL,
	"page_height" integer NOT NULL,
	"layout_config" jsonb NOT NULL,
	"est_actif" boolean DEFAULT true NOT NULL,
	"is_default_for_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
