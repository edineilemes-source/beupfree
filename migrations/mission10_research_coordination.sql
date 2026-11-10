-- Proposed migration for review. Do not apply automatically.
BEGIN;
CREATE TABLE research_claims (
  super_hash varchar(64) PRIMARY KEY CHECK (super_hash ~ '^[a-f0-9]{64}$'),
  master_id varchar(36) NOT NULL REFERENCES products(id),
  owner uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE research_budget (
  singleton boolean PRIMARY KEY CHECK (singleton),
  policy jsonb NOT NULL,
  window_end timestamptz NOT NULL,
  tavily_calls bigint NOT NULL CHECK (tavily_calls >= 0),
  openai_calls bigint NOT NULL CHECK (openai_calls >= 0),
  reserved_microusd bigint NOT NULL CHECK (reserved_microusd >= 0)
);
COMMIT;
