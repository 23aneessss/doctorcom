-- Auth v1 bootstrap (idempotent) for a single medecin account.
-- Run manually in pgAdmin or psql.
--
-- Hash runner (Better-Auth format "salt:key"):
-- bun --cwd packages/auth -e "import { hashPassword } from 'better-auth/crypto'; console.log(await hashPassword('doctor123!'));"
--
-- If you regenerate the hash, replace it in BOTH:
-- 1) account.password
-- 2) utilisateurs.mot_de_passe_hash

BEGIN;

WITH upserted_user AS (
  INSERT INTO "user" (
    id,
    name,
    email,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    'medecin-auth-user',
    'Medecin Principal',
    'tbib@doctorcom.com',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET
    name = EXCLUDED.name,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW()
  RETURNING id
)
INSERT INTO "account" (
  id,
  account_id,
  provider_id,
  user_id,
  password,
  created_at,
  updated_at
)
SELECT
  'medecin-credential-account',
  upserted_user.id,
  'credential',
  upserted_user.id,
  '6cd52985440601603e7843477cedb8fc:5dedf7d78117fce867a08ae7eea93ff0daf8dcd5e243c481662b5e3b92e604412643f2fb801b5723fab8c886fe485545c86b2498ddc90a59a829edb0d20729ce',
  NOW(),
  NOW()
FROM upserted_user
ON CONFLICT (id) DO UPDATE
SET
  account_id = EXCLUDED.account_id,
  provider_id = EXCLUDED.provider_id,
  user_id = EXCLUDED.user_id,
  password = EXCLUDED.password,
  updated_at = NOW();

INSERT INTO utilisateurs (
  id,
  nom,
  prenom,
  email,
  adresse,
  telephone,
  mot_de_passe_hash,
  date_creation,
  role
)
VALUES (
  '9c9b18f8-e89a-4b32-b387-e39f96d0f9e8',
  'Medecin',
  'Principal',
  'tbib@doctorcom.com',
  NULL,
  NULL,
  '6cd52985440601603e7843477cedb8fc:5dedf7d78117fce867a08ae7eea93ff0daf8dcd5e243c481662b5e3b92e604412643f2fb801b5723fab8c886fe485545c86b2498ddc90a59a829edb0d20729ce',
  CURRENT_DATE,
  'medecin'
)
ON CONFLICT (email) DO UPDATE
SET
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  adresse = EXCLUDED.adresse,
  telephone = EXCLUDED.telephone,
  mot_de_passe_hash = EXCLUDED.mot_de_passe_hash,
  role = EXCLUDED.role;

COMMIT;
