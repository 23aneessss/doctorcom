import { Pool } from "pg";

type PatientRow = {
  id: string;
  nom: string;
  prenom: string;
  matricule: string;
  date_naissance: string;
};

type PatientWithRefs = PatientRow & {
  referenceCount: number;
};

type PatientForeignKey = {
  table_schema: string;
  table_name: string;
  column_name: string;
};

const connectionString = process.env.DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Run with --env-file=apps/server/.env");
}

const pool = new Pool({ connectionString });

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function qualifiedTable(fk: PatientForeignKey) {
  return `${quoteIdentifier(fk.table_schema)}.${quoteIdentifier(fk.table_name)}`;
}

function isDashboardDemoPatient(patient: PatientRow) {
  return /-2026-\d{3}$/i.test(patient.matricule);
}

async function getPatientForeignKeys() {
  const result = await pool.query<PatientForeignKey>(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'patients'
      AND ccu.column_name = 'id'
    ORDER BY tc.table_name, kcu.column_name
  `);

  return result.rows;
}

async function getDuplicateGroups() {
  const result = await pool.query<{
    normalized_nom: string;
    normalized_prenom: string;
    rows: PatientRow[];
  }>(`
    SELECT
      lower(trim(nom)) AS normalized_nom,
      lower(trim(prenom)) AS normalized_prenom,
      json_agg(
        json_build_object(
          'id', id,
          'nom', nom,
          'prenom', prenom,
          'matricule', matricule,
          'date_naissance', date_naissance
        )
        ORDER BY matricule
      ) AS rows
    FROM patients
    GROUP BY lower(trim(nom)), lower(trim(prenom))
    HAVING count(*) > 1
    ORDER BY lower(trim(nom)), lower(trim(prenom))
  `);

  return result.rows;
}

async function countPatientReferences(patientId: string, foreignKeys: PatientForeignKey[]) {
  let total = 0;

  for (const fk of foreignKeys) {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${qualifiedTable(fk)} WHERE ${quoteIdentifier(fk.column_name)} = $1`,
      [patientId],
    );
    total += Number(result.rows[0]?.count ?? 0);
  }

  return total;
}

async function resolveCanonicalPatient(
  rows: PatientRow[],
  foreignKeys: PatientForeignKey[],
) {
  const enriched: PatientWithRefs[] = [];

  for (const patient of rows) {
    enriched.push({
      ...patient,
      referenceCount: await countPatientReferences(patient.id, foreignKeys),
    });
  }

  return enriched.sort((left, right) => {
    const leftIsDashboard = isDashboardDemoPatient(left) ? 1 : 0;
    const rightIsDashboard = isDashboardDemoPatient(right) ? 1 : 0;

    if (leftIsDashboard !== rightIsDashboard) {
      return leftIsDashboard - rightIsDashboard;
    }

    if (left.referenceCount !== right.referenceCount) {
      return right.referenceCount - left.referenceCount;
    }

    return left.matricule.localeCompare(right.matricule);
  })[0]!;
}

async function mergePatientIntoCanonical(
  source: PatientRow,
  canonical: PatientRow,
  foreignKeys: PatientForeignKey[],
) {
  const canonicalFemale = await pool.query<{ id: string }>(
    `SELECT id FROM patients_femmes WHERE patient_id = $1 LIMIT 1`,
    [canonical.id],
  );
  const sourceFemale = await pool.query<{ id: string }>(
    `SELECT id FROM patients_femmes WHERE patient_id = $1 LIMIT 1`,
    [source.id],
  );

  if (sourceFemale.rowCount && canonicalFemale.rowCount) {
    await pool.query(`DELETE FROM patients_femmes WHERE patient_id = $1`, [
      source.id,
    ]);
  }

  for (const fk of foreignKeys) {
    if (fk.table_name === "patients_femmes") {
      if (sourceFemale.rowCount && !canonicalFemale.rowCount) {
        await pool.query(
          `UPDATE patients_femmes SET patient_id = $1 WHERE patient_id = $2`,
          [canonical.id, source.id],
        );
      }
      continue;
    }

    await pool.query(
      `UPDATE ${qualifiedTable(fk)} SET ${quoteIdentifier(fk.column_name)} = $1 WHERE ${quoteIdentifier(fk.column_name)} = $2`,
      [canonical.id, source.id],
    );
  }

  await pool.query(`DELETE FROM patients WHERE id = $1`, [source.id]);
}

async function main() {
  const foreignKeys = await getPatientForeignKeys();
  const duplicateGroups = await getDuplicateGroups();

  if (duplicateGroups.length === 0) {
    console.log("No duplicate patients found.");
    return;
  }

  await pool.query("BEGIN");

  try {
    let removedCount = 0;

    for (const group of duplicateGroups) {
      const canonical = await resolveCanonicalPatient(group.rows, foreignKeys);
      const duplicates = group.rows.filter((patient) => patient.id !== canonical.id);

      console.log(
        `Keeping ${canonical.nom} ${canonical.prenom} (${canonical.matricule}) and merging ${duplicates.length} duplicate(s).`,
      );

      for (const duplicate of duplicates) {
        console.log(`  - merging ${duplicate.matricule} into ${canonical.matricule}`);
        await mergePatientIntoCanonical(duplicate, canonical, foreignKeys);
        removedCount += 1;
      }
    }

    if (dryRun) {
      await pool.query("ROLLBACK");
      console.log(`Dry run complete: ${removedCount} duplicate patient(s) would be removed.`);
      return;
    }

    await pool.query("COMMIT");
    console.log(`Cleanup complete: ${removedCount} duplicate patient(s) removed.`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Duplicate patient cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
