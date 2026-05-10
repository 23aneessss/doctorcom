ALTER TABLE "patients" ALTER COLUMN "nss" TYPE varchar(32) USING "nss"::text;
