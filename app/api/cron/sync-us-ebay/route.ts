CREATE TABLE IF NOT EXISTS ebay_sync_state (
    id INTEGER PRIMARY KEY,
    current_offset INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ebay_sync_state (id, current_offset)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
