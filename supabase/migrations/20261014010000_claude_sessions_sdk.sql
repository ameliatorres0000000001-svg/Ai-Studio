-- SDK session identifiers let Agent SDK conversations resume across app requests.
ALTER TABLE claude_sessions ADD COLUMN IF NOT EXISTS sdk_session_id text;
