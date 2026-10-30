# Unmet Studio design

Reference: Bevel (bevel.health), captured by Inspo. Adapted, not copied. Applies to the Studio (`/app`); the landing page keeps its blue hero.

## Feel
Calm, airy, easy. A soft pale-blue gradient behind white cards. One ink color for text and the main button. Color is rare, so it means something when it shows up.

## Color
| Token | Value | Use |
|---|---|---|
| `--ink` | `#1f2025` | text, primary buttons (black pills) |
| `--muted` | `#1f2025` at 60% | secondary text |
| `--text-3` | `#1f2025` at 40% | hints, counts |
| `--surface` | `#ffffff` | cards, composer, active nav |
| `--gray` | `#eef2f7` | quiet buttons, chips, inputs |
| `--tint` | `#dcecfc` | selection, focus ring, highlight |
| page | gradient `#dcecfc → #ebf0f8 → #f5f7fa` | Studio background |
| `--link` | `#0066cc` | text links only |
| `--early-*` | soft yellow | "Early signal", the only status color |

Categories have no color: they're plain text labels. Board stages use a gray-to-black ramp (Spotted lightest, Building darkest), always with their name.

## Type
System font (-apple-system). Headlines weight 600 with tight tracking (-0.03em). Body 17px, weight 400–500, line-height 1.4–1.5.
- Page title: 40px phone / 64px desktop
- Section title: 24px
- Card title: 20px (feed card: 28 / 40px)
- Meta: 13–14px in `--muted`

## Space and shape
4px base step. Sections 48px apart on phones, 80px on desktop. Card padding 24px (32px desktop). Radii: 24px cards, 16px inner blocks, pills fully round. No borders; a very soft shadow only on things that float.

## Rules
- One primary action per card (black pill); everything else is a quiet gray pill or a text link.
- At most one meta line per card: `Category · ↑ Rising · 12 sources`.
- No decorative strips, bands or colored icon tiles.

## Motion
Smooth, quick, never in the way. Only `transform` and `opacity` (plus `block-size` for folding).
- Speeds: 150ms press/hover (`--t-fast`), 250ms appear/move (`--t-med`), springs for sliders and sliding highlights. One easing: `--ease` (`cubic-bezier(.22,1,.36,1)`).
- Entrances: the `.rise` class (fade + 8px rise). Set `--i` on list items for a 40ms stagger (capped at 6). Page switches use `.fade-in` (opacity only, so fixed and sticky children never shift).
- "You are here" backgrounds glide between items with `components/motion/Highlight.tsx` (sidebar, tab bar, feed filters, board stages).
- Depth is the `DepthSlider` (Low / Medium / High): drag, tap or arrow keys; the knob springs to the nearest stop.
- Dialogs and sheets animate in and out with `@starting-style` + `allow-discrete` transitions.
- Reduced motion: CSS animations are switched off in `globals.css`; `MotionProvider` sets `reducedMotion="user"` for the `motion` library.
