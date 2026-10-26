CREATE TABLE gifts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  token           TEXT NOT NULL UNIQUE,
  bouquet_id      TEXT NOT NULL,
  style           TEXT NOT NULL,
  color_mode      TEXT NOT NULL DEFAULT 'color',
  wrap            TEXT NOT NULL DEFAULT 'paper',
  resolution      TEXT NOT NULL DEFAULT 'high',
  from_name       TEXT NOT NULL,
  message         TEXT,
  recipient_email TEXT,
  created_at      TEXT NOT NULL,
  expires_at      TEXT,
  revoked_at      TEXT,
  first_opened_at TEXT,
  open_count      INTEGER NOT NULL DEFAULT 0,
  sent_at         TEXT,
  send_status     TEXT,
  send_error      TEXT
);

CREATE INDEX idx_gifts_created ON gifts(created_at DESC);
