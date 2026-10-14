# Redesign Phases

| Phase | Scope |
|---|---|
| Phase 0 | Setup and gateway capability test (tool use, streaming, prompt caching) |
| Phase 1 | _(table to be filled in — the Phase 0–7 table was not included in the request)_ |
| Phase 2 | _TBD_ |
| Phase 3 | _TBD_ |
| Phase 4 | _TBD_ |
| Phase 5 | _TBD_ |
| Phase 6 | _TBD_ |
| Phase 7 | _TBD_ |

## Manual setup: Google

- [ ] Create a Google Cloud OAuth client ID with application type **Web application**.
- [ ] Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud.
- [ ] Enable Google in **Supabase Auth > Providers** and configure the client ID and secret.
- [ ] Add `https://<domain>/auth/callback` and `http://127.0.0.1:3000/auth/callback` to **Supabase Auth > URL Configuration > Redirect URLs**.

## Manual setup: GitHub OAuth App

- [ ] Create a GitHub OAuth App with homepage URL set to the app domain.
- [ ] Set the Authorization callback URL to `https://<domain>/api/connectors/github/callback`.
- [ ] Add `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` to the server environment.
- [ ] Generate `CONNECTOR_ENCRYPTION_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and add it to the server environment.
- [ ] The app requests the `repo read:user` scopes for private repository access and profile metadata.
