create index if not exists medicament_embeddings_embedding_hnsw_idx
on medicament_embeddings
using hnsw (embedding vector_cosine_ops);
