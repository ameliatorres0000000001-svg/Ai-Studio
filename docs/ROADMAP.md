# Roadmap

Ordered by value; each item is one shippable change.

## Next

1. **Apply migrations + smoke test on staging** — run all 8 files in order,
   submit a test payment, approve in /admin, confirm tier unlock.
2. **Real KHQR payload** — generate the amount-bound KHQR server-side
   (currently a static `PAYMENTS_KHQR_IMAGE_URL`) so the scanned amount can't
   drift from the plan price.
3. **Usage alerts** — warn at 80% of daily quota in the chat UI (data already
   in `GET /api/usage`).
4. **Gemini upstream** — fill `upstreamModel` for the hidden `gemini` entry
   once the Google route is configured.

## Later

5. **Auto-renewal reminders** — email/nudge before `user_plans.expires_at`;
   grace period instead of hard drop to Free.
6. **Per-model pricing display** — show token costs per model in the picker
   (usage rows already stored).
7. **Workspace sharing** — invite a second user to a workspace (RLS +
   membership table; currently strictly one owner).
8. **Streaming responses** — SSE for chat so long answers render progressively.
9. **Eval set for Code mode** — golden tasks per model to justify tier mapping.

## Non-goals

- Automatic payment capture (manual review is the product requirement).
- Multi-region / serverless (workspaces need one persistent disk).
