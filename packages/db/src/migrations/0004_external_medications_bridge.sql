DO $$
BEGIN
  CREATE TYPE "public"."historique_traitement_source" AS ENUM('manuel', 'ordonnance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "historique_traitements" DROP CONSTRAINT IF EXISTS "historique_traitements_medicament_id_medicaments_id_fk";
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" DROP CONSTRAINT IF EXISTS "ordonnance_medicaments_medicament_id_medicaments_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "historique_traitements_medicament_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "ordonnance_medicaments_medicament_id_idx";
--> statement-breakpoint
ALTER TABLE "pre_rempli_medicaments" RENAME COLUMN "medicament_nom" TO "nom_medicament";
--> statement-breakpoint
ALTER TABLE "historique_traitements" RENAME COLUMN "medicament_id" TO "medicament_externe_id";
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" RENAME COLUMN "medicament_id" TO "medicament_externe_id";
--> statement-breakpoint
ALTER TABLE "historique_traitements"
  ALTER COLUMN "medicament_externe_id" TYPE varchar(64)
  USING "medicament_externe_id"::text;
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments"
  ALTER COLUMN "medicament_externe_id" TYPE varchar(64)
  USING "medicament_externe_id"::text;
--> statement-breakpoint
ALTER TABLE "pre_rempli_medicaments" ADD COLUMN "medicament_externe_id" varchar(64);
--> statement-breakpoint
ALTER TABLE "pre_rempli_medicaments" ADD COLUMN "dosage" varchar(128);
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ADD COLUMN "nom_medicament" varchar(255);
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ADD COLUMN "dci" varchar(255);
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ADD COLUMN "dosage" varchar(128);
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD COLUMN "nom_medicament" varchar(255);
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD COLUMN "dosage" varchar(128);
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD COLUMN "ordonnance_id" uuid;
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD COLUMN "ordonnance_medicament_id" uuid;
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD COLUMN "source_type" "historique_traitement_source" DEFAULT 'manuel' NOT NULL;
--> statement-breakpoint
UPDATE "pre_rempli_medicaments"
SET "medicament_externe_id" = "id"::text
WHERE "medicament_externe_id" IS NULL;
--> statement-breakpoint
UPDATE "ordonnance_medicaments" AS om
SET
  "nom_medicament" = COALESCE(m."dci", 'medicament migre'),
  "dci" = m."dci",
  "dosage" = m."dosage"
FROM "medicaments" AS m
WHERE om."medicament_externe_id" = m."id"::text;
--> statement-breakpoint
UPDATE "ordonnance_medicaments"
SET "nom_medicament" = COALESCE("nom_medicament", 'medicament migre')
WHERE "nom_medicament" IS NULL;
--> statement-breakpoint
UPDATE "historique_traitements" AS ht
SET
  "nom_medicament" = COALESCE(m."dci", 'medicament migre'),
  "dosage" = m."dosage"
FROM "medicaments" AS m
WHERE ht."medicament_externe_id" = m."id"::text;
--> statement-breakpoint
UPDATE "historique_traitements"
SET "nom_medicament" = COALESCE("nom_medicament", 'medicament migre')
WHERE "nom_medicament" IS NULL;
--> statement-breakpoint
ALTER TABLE "pre_rempli_medicaments" ALTER COLUMN "medicament_externe_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ALTER COLUMN "nom_medicament" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "historique_traitements" ALTER COLUMN "nom_medicament" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD CONSTRAINT "historique_traitements_ordonnance_id_ordonnance_id_fk" FOREIGN KEY ("ordonnance_id") REFERENCES "public"."ordonnance"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD CONSTRAINT "historique_traitements_ordonnance_medicament_id_ordonnance_medicaments_id_fk" FOREIGN KEY ("ordonnance_medicament_id") REFERENCES "public"."ordonnance_medicaments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pre_rempli_medicaments_medicament_externe_id_idx" ON "pre_rempli_medicaments" USING btree ("medicament_externe_id");
--> statement-breakpoint
CREATE INDEX "ordonnance_medicaments_medicament_externe_id_idx" ON "ordonnance_medicaments" USING btree ("medicament_externe_id");
--> statement-breakpoint
CREATE INDEX "historique_traitements_medicament_externe_id_idx" ON "historique_traitements" USING btree ("medicament_externe_id");
--> statement-breakpoint
CREATE INDEX "historique_traitements_ordonnance_id_idx" ON "historique_traitements" USING btree ("ordonnance_id");
--> statement-breakpoint
CREATE INDEX "historique_traitements_ordonnance_medicament_id_idx" ON "historique_traitements" USING btree ("ordonnance_medicament_id");
--> statement-breakpoint
CREATE INDEX "historique_traitements_source_type_idx" ON "historique_traitements" USING btree ("source_type");
--> statement-breakpoint
DROP TABLE "medicaments";
