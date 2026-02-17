-- ==============================================================================
-- 🔑 IDEMPOTENCY KEY STORE
-- ==============================================================================

CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, FAILED
  response_body JSONB, -- The saved result to return
  response_status INT, -- HTTP Status code
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'), -- TTL
  PRIMARY KEY (key, user_id)
);

-- Fast lookup index
CREATE INDEX idx_idempotency_keys_user ON idempotency_keys (user_id, key);

-- Cleanup job (Optional if using pg_cron or scheduled worker)
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();
