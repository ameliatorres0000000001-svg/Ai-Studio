---
name: Warm Editorial Assistant
colors:
  surface: '#fdf9f4'
  surface-dim: '#ddd9d5'
  surface-bright: '#fdf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ee'
  surface-container: '#f1ede8'
  surface-container-high: '#ece7e3'
  surface-container-highest: '#e6e2dd'
  on-surface: '#1c1c19'
  on-surface-variant: '#44474f'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f4f0eb'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#475e8b'
  primary: '#233b65'
  on-primary: '#ffffff'
  primary-container: '#3b527e'
  on-primary-container: '#afc6f9'
  inverse-primary: '#afc7fa'
  secondary: '#2c6a48'
  on-secondary: '#ffffff'
  secondary-container: '#adeec3'
  on-secondary-container: '#306e4c'
  tertiary: '#503700'
  on-tertiary: '#ffffff'
  tertiary-container: '#6d4d00'
  on-tertiary-container: '#f2bf5f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#afc7fa'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#2f4672'
  secondary-fixed: '#b0f1c6'
  secondary-fixed-dim: '#94d5ab'
  on-secondary-fixed: '#002110'
  on-secondary-fixed-variant: '#0e5132'
  tertiary-fixed: '#ffdea7'
  tertiary-fixed-dim: '#f2bf5f'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5e4200'
  background: '#fdf9f4'
  on-background: '#1c1c19'
  surface-variant: '#e6e2dd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: '600'
    lineHeight: 30px
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 27px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system defines a calm, respectful, and deeply humane conversational workspace built specifically for mobile workflows, Telegram Mini Apps, and bilingual Khmer-Latin environments. Drawing from modern editorial interfaces and restrained product design, the interface rejects aggressive neon tech aesthetics in favor of parchment-like warmth, serene structure, and exceptional legibility.

### Tone & Sensibility
- **Mindful & Attentive**: The experience feels steady, unhurried, and quiet, minimizing visual fatigue across long conversational sessions.
- **Culturally Attuned**: Khmer typography requires natural vertical rhythm, generous breathing space, and open baselines. Glyphs are never crammed or artificially flattened.
- **Tactile Softness**: Flat surfaces sit gracefully atop warm off-white canvases, defined by micro-hairline borders and barely perceptible ambient shadows rather than harsh drop shadows.
- **Understated Intelligence**: Modern AI capability expressed through subtle tonal transitions, polished micro-copy, and refined slate-indigo accents.

## Colors

The palette establishes an organic, literary warmth using layered off-whites, balanced ink tones, and a serene slate-indigo primary accent.

### Palette Architecture
- **Canvas Base (`#FAF9F6`)**: Natural parchment canvas that serves as the root foundation, mitigating screen glare.
- **Surface Elevation (`#FFFFFF`)**: Pure white containers for primary interactive elements, message cards, and structured modules.
- **Surface Container (`#F4F2EC`)**: Subtle warm neutral tier for secondary cards, incoming agent speech bubbles, and inactive toggle pills.
- **Primary Ink (`#2B2A27`)**: Deep charcoal brown providing comfortable reading contrast without the stark harshness of pitch black.
- **Muted Ink (`#6F6B63`)**: Grounded stone tone for timestamps, secondary labels, and assistive descriptions.
- **Structural Dividers (`#E8E5DF`)**: Refined hairline border color applied across borders, dividers, and card outlines.

### Brand & Functional Accents
- **Primary Slate-Indigo (`#3B527E` to `#4B6396`)**: Anchors primary buttons, active navigation states, and prompt submission actions. Can be applied as a subtle 135° directional wash.
- **Success (`#5E9C76`)**: Subdued sage green indicating connected bots, completed stream runs, and operational health.
- **Warning (`#C99A3E`)**: Warm amber for token usage thresholds, draft notices, and rate warnings.
- **Destructive (`#C65F5F`)**: Soft terracotta red for destructive actions, disconnection states, and runtime errors.

## Typography

Typography rules must guarantee flawless rendering across Khmer script and Latin alphanumeric strings without baseline collisions or glyph clipping.

### Font Pairing & Stack
- **Primary Khmer Engine**: `Kantumruy Pro`, `Noto Sans Khmer`, sans-serif.
- **Latin & Numerical Support**: `Inter`, system-ui, -apple-system.
- **Code & Token Streams**: Monospaced snippets fallback to `JetBrains Mono` or `Courier Prime`.

### Rules for Khmer Text
- **Minimum Legible Size**: Never render Khmer body copy smaller than 15px. Auxiliary UI metadata may use 13px or 14px, but labels below 12px are prohibited for Khmer glyphs.
- **Relaxed Vertical Metric**: Khmer vowel clusters and subscript consonants (cheung) require line-height multipliers of 1.7 to 1.85 to eliminate ascender and descender clashes.
- **Tracking**: Set letter-spacing to `0` or `+0.01em`. Never compress letter-spacing on Khmer text.
- **Line Breaking**: Apply `word-break: break-word` and respect zero-width space boundaries (`​`) for clean wrapping across viewports.

## Layout & Spacing

The layout is built mobile-first, targeting viewport constraints common to Telegram Mini Apps (TMA) and responsive mobile web views, with adaptive expansion for tablet viewports.

### Rhythm & Safe Boundaries
- **Rhythm Base**: 4px base increment, organized into distinct spacing intervals: 4px (`xs`), 8px (`sm`), 16px (`md`), 24px (`lg`), and 32px (`xl`).
- **Touch Target Integrity**: Interactive targets maintain a strict minimum dimension of 44×44px, expanded to 48px height on primary bottom bars and prompt inputs.
- **Enclosure Awareness**: Top margin accounts for the TMA native title bar (`var(--tg-viewport-height)` / safe-area-inset-top). Bottom layout adds dynamic padding for virtual home indicators (`env(safe-area-inset-bottom, 16px)` + 64px bottom nav).
- **Desktop/Tablet Breakpoint**: At viewports exceeding 768px, the canvas centers into an optimized conversational column capped at a maximum width of 680px with 24px horizontal margins.

## Elevation & Depth

Visual hierarchy uses surface layering and ultra-delicate ink-tinted ambient diffusion rather than standard blurry drop shadows.

### Surface Tiers
- **Tier 0 (Root)**: `#FAF9F6` base page background.
- **Tier 1 (Cards & Input Area)**: `#FFFFFF` with a 1px solid border in `#E8E5DF`.
- **Tier 2 (Chat Bubbles & Inset Panels)**: `#F4F2EC` resting borderless against pure white, or `#FFFFFF` against canvas with ambient halo.
- **Tier 3 (Floating Bars & Action Sheets)**: Elevated surfaces combine `#FFFFFF` with an ambient shadow: `0 4px 20px -2px rgba(43, 42, 39, 0.05), 0 1px 3px 0 rgba(43, 42, 39, 0.03)` alongside the standard hairline border.

### Micro-Hairlines
All explicit boundaries use a 1px solid `#E8E5DF` treatment. For high-density displays, borders can be resolved as 0.5px physical strokes to preserve an airy, paper-weight aesthetic.

## Shapes

The shape system blends friendly structural soft curves with pill-shaped interactive anchors, reinforcing comfort and modern mobile usability.

### Geometry Specifications
- **Standard Cards & Surfaces**: 16px to 20px (`rounded-lg` to `rounded-xl`). Provides a soft framing for message clusters and bot configuration cards.
- **Input Enclosures**: 16px corner radius for expanding multiline chat fields.
- **Buttons, Badges & Chips**: Strict full-pill radius (`9999px`) for action triggers, segmented filters, and conversation suggestion pills.
- **Modal Drawers & Action Sheets**: 24px radius on top-left and top-right corners with an organic 36×4px pill drag indicator at the head.

## Components

### Chat Message Bubbles
- **User Message**: Aligned right. Filled with primary slate-indigo (`#3B527E`), text rendered in `#FFFFFF`. Border-radius is 18px with the bottom-right tail tucked to 6px.
- **Agent Message**: Aligned left. Filled with surface container (`#F4F2EC`) or pure `#FFFFFF` bounded by `#E8E5DF`. Text rendered in primary ink (`#2B2A27`). Border-radius is 18px with bottom-left tail tucked to 6px.
- **Khmer Typography Handling**: Message bodies use `body-md` (15px/27px line-height) to prevent cramped subscript overlap in conversational responses.

### Input Prompt Bar
- Fixed above the keyboard and safe area.
- Multi-line textarea auto-expanding from 44px to a max-height of 140px.
- Container: `#FFFFFF` bordered with `#E8E5DF`, corner radius 20px, horizontal padding 16px, vertical padding 10px.
- Send Button: Circular 36×36px pill in `#3B527E` with an icon glyph in `#FFFFFF`. Inactive state softens to `#F4F2EC` with `#6F6B63` glyph.

### Buttons & Suggestion Chips
- **Primary Button**: Full pill (`9999px`), 48px height, background `#3B527E`, text `#FFFFFF`, font-weight 500.
- **Secondary Button**: Full pill, 48px height, background `#F4F2EC`, text `#2B2A27`, hairline border `#E8E5DF`.
- **Prompt Starter Chips**: Full pill, 36px height, padding 8px 16px, background `#FFFFFF`, border 1px solid `#E8E5DF`, text `label-md` `#2B2A27`. Active state transitions to `#F4F2EC`.

### Bottom Navigation Bar
- Fixed container at viewport base, backed by translucent `#FAF9F6` with 12px blur filter and top hairline border `#E8E5DF`.
- Height: 60px + `env(safe-area-inset-bottom)`.
- 4 Equidistant Tabs:
  1. **ផ្ទះ** (Home)
  2. **Bot របស់ខ្ញុំ** (My Bots)
  3. **ជំនួយ** (Help)
  4. **គណនី** (Account)
- Typography: `label-sm` (12px Khmer font size with 18px line-height to retain mark fidelity).
- Inactive state: `#6F6B63`. Active state: `#3B527E` with a micro-dot indicator below the label.

### Status Indicators & Cards
- **Bot Cards**: Background `#FFFFFF`, 16px padding, 18px border radius, 1px hairline border. Features an avatar slot (44×44px, 12px radius), title in `headline-md`, bot handle/role in `label-md` (`#6F6B63`), and a green status pill (`#5E9C76` at 10% opacity with a solid dot) for active state.
- **Form Inputs**: 48px height, `#FFFFFF` background, 14px radius, 1px border in `#E8E5DF`. Focus state outlines with `#3B527E` at 1.5px without harsh neon glow rings.