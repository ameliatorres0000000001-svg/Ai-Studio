# DESIGN.md — TeleScripts Agent UI/UX Design System

## 1. Product Vision & Overview
**TeleScripts Agent** is an intuitive, mobile-first Khmer-language AI agent designed specifically for individuals, merchants, and small businesses who cannot code. It bridges the gap between conversational intent and production-grade Telegram Bots and Telegram Mini Apps. The user converses entirely in Khmer, provides key details via quick-reply chips and mini inputs, and connects their Telegram bot safely with zero manual token-handling.

---

## 2. Core Design Principles
1. **Calm, Editorial & Warm**: Inspired by modern generative interfaces (Claude, ChatGPT). Avoid neon, heavy solid dark panels, or aggressive saturated gradients.
2. **Zero Technical Overhead**: The user never touches `.env`, webhooks, API tokens, or server settings. BotFather interactions are automated or verified via one-touch Telegram deeplinks.
3. **Khmer-First Typographic Rigor**:
   - Primary Font: **Kantumruy Pro** / **Noto Sans Khmer** for Khmer copy.
   - Latin & Numbers: **Inter** for clean figures and currency.
   - Spacing & Flow: Minimum line-height of `1.7` (Khmer vowels and subscripts require vertical room).
   - Minimum body size of `15px` across all mobile viewports.
4. **Ergonomic Mobile Touchpoints**: Minimum `44px` interactive touch targets, thumb-reachable primary actions, bottom navigation bar with safe-area bottom insets for iOS and Telegram Mini App webviews.

---

## 3. Design Tokens

### Colors
- **Background (App Canvas)**: `#FAF9F6` (Warm off-white)
- **Surface (Cards, Bottom Sheet)**: `#FFFFFF` (Pure white)
- **Surface Muted / Tint**: `#F4F2EC` (Warm cream container)
- **Surface Dim / Active**: `#ECE9E1`
- **Hairline Borders**: `#E8E5DF` (1px subtle border)
- **Text Primary**: `#2B2A27` (Deep charcoal, warm black)
- **Text Secondary / Muted**: `#6F6B63` (Neutral warm slate)
- **Text Tertiary / Disabled**: `#9E9A90`
- **Primary Brand Accent**: `#3B527E` (Soft indigo slate, subtle gradient to `#4B6396`)
- **Semantic Success**: `#5E9C76` (Desaturated sage green)
- **Semantic Warning**: `#C99A3E` (Desaturated warm amber)
- **Semantic Error / Danger**: `#C65F5F` (Desaturated warm coral)

### Typography
- **Heading 1**: 24px / 1.5 / Bold
- **Heading 2**: 20px / 1.5 / SemiBold
- **Heading 3**: 17px / 1.6 / SemiBold
- **Body Regular**: 15px / 1.7+ / Regular (Kantumruy Pro)
- **Body Small / Caption**: 13px / 1.6 / Regular
- **Micro / Badge**: 11px / 1.4 / Medium

### Radii & Elevation
- **Card Radius**: `16px`
- **Pill Radius**: `9999px` (Buttons, Chips, Badges)
- **Input Radius**: `14px`
- **Shadow**: `0 2px 8px rgba(43, 42, 39, 0.04), 0 1px 2px rgba(43, 42, 39, 0.02)`
- **Elevation Sheet**: `0 -4px 20px rgba(43, 42, 39, 0.08)`

---

## 4. Screen Architecture & Purpose (11 Screens)
1. **01-login.html (Login & Onboarding)**: Telegram and Google one-tap authentication with concise Khmer value guarantee ("បង្កើត Bot ក្នុងពេល ៥ នាទី ដោយមិនបាច់ចេះកូដ").
2. **02-home.html (Home & Quick Prompts)**: Central prompt composer ("ប្រាប់ខ្ញុំថាអ្នកចង់បាន bot អ្វី..."), Khmer voice input, 4 quick-start chips, and live project cards.
3. **03-builder-chat.html (AI Conversational Builder)**: Clarifying step-by-step chat flow, sticky progress indicator ("ចំណុចដែលបានដឹង 3/6"), dynamic product cards, and quick-reply payment pills (KHQR, COD).
4. **04-secure-connect.html (Telegram Deep Link & Security)**: Reassuring lock explanation; one-tap direct authorization to Telegram (@MealeaStyleBot); zero token/password copy-pasting.
5. **05-build-progress.html (Live Architecture Timeline)**: 5 sequential status steps (Project Setup, Database, Logic, Cloud Deploy, Smoke Test) with active spinner, collapsible logs, and AI auto-repair button.
6. **06-success.html (Deployment Success & Handover)**: Peaceful celebration without annoying confetti; action cards: "បើក bot ក្នុង Telegram", "បើក Mini App", "ផ្ទាំងគ្រប់គ្រង", and legal ownership declaration.
7. **07-my-bots.html (Bot Portfolio & Metrics)**: Active bot list with status dots, today's order counts, quick settings, and analytics highlights.
8. **08-bot-detail.html (Bot Management Hub)**: Tabs for ទិន្នន័យ (Orders), ការកំណត់ (Settings), កំណត់ត្រា (Logs), and ជំនួយពី AI (AI prompt modifier "ប្រាប់ AI ឲ្យកែ").
9. **09-ownership.html (Ownership & Export Guarantee)**: Clarity regarding user ownership of bot, contacts, customer database, and automated AI server maintenance.
10. **10-account-plan.html (Account, Usage & Plan)**: Resource meter (active messages/month), current plan card, payment receipts, and language/support settings.
11. **11-states.html (Empty, Skeleton, Offline, Error)**: State patterns ensuring graceful degradation during poor network conditions or first-time empty lists.

---

## 5. Mobile & Telegram Mini App Compatibility
- Viewports tested: `390x844` (standard modern iOS/Android) and `360x780` (narrow mobile check).
- Telegram Mini App viewport safety: Bottom navbar stays above Telegram's native home bar using `padding-bottom: max(16px, env(safe-area-inset-bottom))`.
