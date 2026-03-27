import type { db as databaseClient } from "@doctor.com/db";
import { aiRepository } from "../qna/repo";

export type { FullPatientData } from "../qna/repo";

type DatabaseClient = typeof databaseClient;

export class DocumentAnomalyRepository {
  async getFullPatientData(
    database: DatabaseClient,
    patientId: string,
  ) {
    return aiRepository.getFullPatientData(database, patientId);
  }
}

export const documentAnomalyRepository = new DocumentAnomalyRepository();
