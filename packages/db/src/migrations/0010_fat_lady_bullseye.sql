ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_chemin_fichier" text;--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_type_fichier" varchar(64);--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_taille_fichier" integer;
