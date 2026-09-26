CREATE TABLE IF NOT EXISTS okved (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    is_leaf BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_okved_name
    ON okved USING gin (to_tsvector('russian', name));

CREATE INDEX IF NOT EXISTS idx_okved_level
    ON okved (level);

CREATE INDEX IF NOT EXISTS idx_okved_leaf
    ON okved (is_leaf);