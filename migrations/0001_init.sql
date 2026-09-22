CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  played_at TEXT NOT NULL DEFAULT (datetime('now')),
  w1 INTEGER NOT NULL REFERENCES players(id),
  w2 INTEGER NOT NULL REFERENCES players(id),
  l1 INTEGER NOT NULL REFERENCES players(id),
  l2 INTEGER NOT NULL REFERENCES players(id),
  result INTEGER NOT NULL CHECK (result IN (1,2,3)),
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_by TEXT
);
CREATE INDEX idx_matches_played ON matches(played_at);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);
