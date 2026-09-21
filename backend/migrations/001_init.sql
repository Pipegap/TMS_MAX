CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  max_user_id  BIGINT NOT NULL UNIQUE,
  first_name   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  region_id     TEXT NOT NULL,
  business_form TEXT NOT NULL,
  stage         TEXT NOT NULL,
  industry      TEXT NOT NULL,
  employees     TEXT NOT NULL,
  needs         TEXT[] NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Правила подбора хранятся данными: пустой массив = «без ограничений».
CREATE TABLE support_measures (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('federal', 'regional')),
  summary     TEXT NOT NULL,
  amount_text TEXT,
  conditions  JSONB NOT NULL DEFAULT '[]',
  documents   JSONB NOT NULL DEFAULT '[]',
  apply_url   TEXT,
  source_url  TEXT,
  verified_at DATE,
  deadline_at DATE,
  is_rolling  BOOLEAN NOT NULL DEFAULT false,
  is_demo     BOOLEAN NOT NULL DEFAULT true,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  regions     TEXT[] NOT NULL DEFAULT '{}',
  forms       TEXT[] NOT NULL DEFAULT '{}',
  stages      TEXT[] NOT NULL DEFAULT '{}',
  industries  TEXT[] NOT NULL DEFAULT '{}',
  employees   TEXT[] NOT NULL DEFAULT '{}',
  needs       TEXT[] NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_measures_active_idx ON support_measures (is_active);

CREATE TABLE favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measure_id INTEGER NOT NULL REFERENCES support_measures(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, measure_id)
);

CREATE TABLE reminders (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measure_id INTEGER NOT NULL REFERENCES support_measures(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  sent_at    TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reminders_due_idx ON reminders (remind_at) WHERE status = 'pending';

CREATE TABLE match_runs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_snapshot JSONB NOT NULL,
  result_ids       INTEGER[] NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
