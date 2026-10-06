/*
# Deployments: store the provider's deployment id and target

- external_id: Vercel deployment id (used to poll status)
- target: 'preview' | 'production'
*/

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target text DEFAULT 'preview';
CREATE INDEX IF NOT EXISTS idx_deployments_external ON deployments(external_id);
