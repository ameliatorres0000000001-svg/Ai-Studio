# TeleScripts Agent Mobile UI/UX Package
**Khmer-Language AI Agent for No-Code Telegram Bots & Telegram Mini Apps**

## Overview
TeleScripts Agent is designed for Cambodian entrepreneurs, content creators, and local retail merchants to generate, connect, and run production-grade Telegram bots without writing any code, touching servers, or seeing API tokens.

---

## File Structure
- `DESIGN.md`: Complete design principles, token values, typography specifications, screen catalog, and UX rationale.
- `tokens.css`: Native CSS variable definitions for light theme, warm surfaces, and Kantumruy Pro/Noto Sans Khmer typography.
- `tokens.json`: Machine-readable tokens for multi-platform styling.
- `components.html`: Live interactive demonstration of all UI components (buttons, chips, badges, inputs, chat bubbles, timeline steps, segmented controls).
- `screens/`:
  - `01-login.html`: Google and Telegram single-tap sign in with reassuring Khmer privacy guarantees.
  - `02-home.html`: Large prompt composer, voice input, 4 quick starter chips, and recent live project cards.
  - `03-builder-chat.html`: Guided AI chat with clarifying questions, item configuration cards, and KHQR/COD options.
  - `04-secure-connect.html`: Reassuring 3-step Telegram deeplink connection (never paste tokens in chat).
  - `05-build-progress.html`: Vertical progress timeline with live stages, error auto-recovery, and collapsible technical logs.
  - `06-success.html`: Confetti-free calm celebration with one-tap launchers ("បើក bot ក្នុង Telegram", "បើក Mini App") and ownership verification.
  - `07-my-bots.html`: Multi-bot portfolio dashboard with live status indicators and today's metrics.
  - `08-bot-detail.html`: Tabbed bot administration with data, configuration, live logs, and "ប្រាប់ AI ឲ្យកែ" prompt modifier.
  - `09-ownership.html`: Explicit data and code ownership guarantee card.
  - `10-account-plan.html`: Message volume usage meters, subscription tier, and payment history.
  - `11-states.html`: Empty, loading skeletons, offline, and error resilience screens.

---

## Typography & Localization Guarantee
- All screen copy is in authentic, natural Khmer.
- Generous line-height (`1.75`) accommodates Khmer superscripts and subscripts without clipping.
- Minimum body text is set to `15px` to preserve legibility on small phone screens.
- All touch targets strictly follow iOS and Telegram Mini App guideline minimums of `44px`+.
