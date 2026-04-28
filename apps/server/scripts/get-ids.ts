import { db } from "@doctor.com/db";
import { patients, suivi, utilisateurs } from "@doctor.com/db/schema";

async function main() {
  const [user] = await db.select().from(utilisateurs).limit(1);
  const [patient] = await db.select().from(patients).limit(1);
  const [s] = await db.select().from(suivi).limit(1);

  console.log(JSON.stringify({
    userId: user?.id,
    userEmail: user?.email,
    patientId: patient?.id,
    suiviId: s?.id
  }, null, 2));
  process.exit(0);
}

main();
