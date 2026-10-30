# Unmet design: "Unmet editorial"

Reference: Cluely (cluely.com) via Inspo, adapted, not copied. One visual language from the landing page to the Studio (`/app`).

## Feel
Calm, confident, editorial. A big serif headline does the talking; everything else is quiet sans-serif on warm paper. Color is rare and always means something.

## Type
| Role | Font | Notes |
|---|---|---|
| Display | EB Garamond 500 (`--font-serif`) | Big headlines only: the landing hero (46–96px, line-height 0.96), section titles, Studio page titles (every `h1` inside `.shell`), feed card headlines, the welcome and onboarding titles |
| Text and UI | Geist 400/500 (`--font`) | Body 16–17px / 1.5, captions 13–14px, buttons 15–16px / 500 |

Never use the serif for UI controls or body text. Small uppercase labels ("HOW IT WORKS") use Geist 500, 13px, 0.06em tracking, slate.

## Color
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0e1726` | text, selected chips |
| `--navy` / `--primary` | `#073a8b` | brand, the hero, **the one main action per screen** (send, Save, Validate, Start exploring) |
| `--mid` | `#369adf` | links, focus |
| `--sky` | `#83caec` | highlights on navy, the "rising" accent |
| `--paper` | `#f7f5ef` | page background (landing sections, Studio, welcome) |
| sidebar | `#f2efe7` | the Studio frame, one step deeper than paper |
| `--white` | `#ffffff` | cards |
| `--sand` / `--line` | `#dad4c3` / `#e6e0d2` | hairlines, quiet borders |
| `--gray` | `#f1eee6` | quiet buttons and chips inside white cards |
| `--slate` | `#588ca4` | secondary text on navy, labels |
| `--early-*` | soft yellow | "Early signal" / "Sample", the only warning color |

White cards on paper. Navy is for one action per screen, never decoration.

## Space and shape
4px base step. Landing sections 72px apart on phones and 128px on desktop; Studio sections 48 / 80px. Radius: 12px controls, 16px inner blocks, 24px cards, 28–32px hero panels and sheets, pills fully round. Hairlines in sand instead of shadows; a soft shadow only on floating things (nav, sheets, popovers).

## Landing
A navy full-bleed hero with the serif headline over a slowly drifting wall of **real complaint quotes** from the feed, never stock imagery. Then paper sections:
1. sources strip
2. how it works
3. a real example report (hidden until the live feed has one)
4. why trust it
5. pricing
6. FAQ

The page closes with a navy call to action and footer. The page canvas is navy, so the overscroll bounce never shows white. Copy is specific, with no invented numbers or testimonials.

## Entry flow
Landing CTAs → `/welcome` (sign in, or continue as guest) → `/welcome/start` onboarding (who you build for → niches to follow, Skip always available) → Studio. Guests can use everything except Medium and High research.

## Studio
- **Top bar:** clear at the top of the page, frosted paper with a hairline once content scrolls under it.
- **Sidebar:** deeper paper with a hairline; the active item is a white pill that glides.
- **Page titles:** serif.
- **Verdicts:** "Strong" on navy, "Worth a look" on tint, "Weak" on white.

## Rules
- One primary action per card (navy pill); everything else is a quiet pill or a text link.
- At most one meta line per card: `Category · ↑ Rising · 12 sources`.
- No decorative strips, bands or colored icon tiles.

## Motion
Smooth, quick, never in the way. Only `transform` and `opacity` (plus `block-size` for folding).
- **Speeds:** 150ms press/hover (`--t-fast`), 250ms appear/move (`--t-med`), springs for sliders and sliding highlights. One easing: `--ease` (`cubic-bezier(.22,1,.36,1)`).
- **Entrances:** the `.rise` class (fade + 8px rise). Set `--i` on list items for a 40ms stagger (capped at 6). Page switches use `.fade-in`.
- **"You are here" backgrounds** glide between items with `components/motion/Highlight.tsx`.
- **Depth control:**
  - It works like ChatGPT's Thinking control: a pill in the composer (`DepthPicker`) opens a popover with the `DepthSlider`.
  - Guests see Medium and High locked.
- **Dialogs and sheets** animate in and out with `@starting-style` + `allow-discrete`.
- **The landing quote wall** drifts slowly and stops for reduced motion.
- **Reduced motion:** CSS animations are off in `globals.css`; `MotionProvider` sets `reducedMotion="user"`.
