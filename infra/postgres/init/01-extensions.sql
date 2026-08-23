-- Enable extensions Beaver relies on.
-- pg_trgm: fuzzy / typo-tolerant search for products, customers, suppliers.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- unaccent: normalize accents for search (Swahili/English mixed input).
CREATE EXTENSION IF NOT EXISTS unaccent;
-- vector: installed-but-reserved for future document-RAG / semantic memory.
CREATE EXTENSION IF NOT EXISTS vector;
