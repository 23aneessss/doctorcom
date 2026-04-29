import { medicationsDb } from "@doctor.com/medications-db";
import { medicament_embeddings } from "@doctor.com/medications-db/schema";
import { eq, sql } from "drizzle-orm";

export interface VectorSearchHit {
  medicament_id: number;
  similarity: number;
}

export class OrdonnanceVectorRepository {
  async upsertEmbedding(params: {
    medicamentId: number;
    embedding: number[];
    embeddingModel: string;
    contentHash: string;
    preview: string;
  }): Promise<void> {
    await medicationsDb
      .insert(medicament_embeddings)
      .values({
        medicament_id: params.medicamentId,
        embedding: params.embedding,
        embedding_model: params.embeddingModel,
        embedding_content_hash: params.contentHash,
        embedding_payload_preview: params.preview,
      })
      .onConflictDoUpdate({
        target: medicament_embeddings.medicament_id,
        set: {
          embedding: params.embedding,
          embedding_model: params.embeddingModel,
          embedding_content_hash: params.contentHash,
          embedding_payload_preview: params.preview,
          updated_at: new Date(),
        },
      });
  }

  async deleteEmbedding(medicamentId: number): Promise<void> {
    await medicationsDb
      .delete(medicament_embeddings)
      .where(eq(medicament_embeddings.medicament_id, medicamentId));
  }

  async getEmbeddingContentHash(medicamentId: number): Promise<string | null> {
    const [row] = await medicationsDb
      .select({ hash: medicament_embeddings.embedding_content_hash })
      .from(medicament_embeddings)
      .where(eq(medicament_embeddings.medicament_id, medicamentId))
      .limit(1);

    return row?.hash ?? null;
  }

  async getTopVectorMatches(params: {
    queryEmbedding: number[];
    limit: number;
  }): Promise<VectorSearchHit[]> {
    const vectorLiteral = `[${params.queryEmbedding.join(",")}]`;
    const result = await medicationsDb.execute(sql`
      select
        medicament_id,
        (1 - (embedding <=> ${vectorLiteral}::vector))::float as similarity
      from medicament_embeddings
      order by embedding <=> ${vectorLiteral}::vector
      limit ${params.limit}
    `);

    const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows
      .map((row) => ({
        medicament_id: Number(row.medicament_id),
        similarity: Number(row.similarity),
      }))
      .filter(
        (row): row is VectorSearchHit =>
          Number.isFinite(row.medicament_id) && Number.isFinite(row.similarity),
      );
  }
}

export const ordonnanceVectorRepository = new OrdonnanceVectorRepository();
