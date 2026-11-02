# Unmet design: "v3", sky and glossy blue

Reference: Cluely (cluely.com), adapted, not copied. Approved as the v3 boards in the Claude Design canvas. One visual language from the landing page to the Studio (`/app`).

## Feel

Calm, bright and confident. A big serif headline on a sky that fades into a white page; everything else is quiet sans-serif. Blue is the only color, and the shiny blue button marks the one thing to do.

## Type

| Role           | Font                                   | Notes                                                                                                                                            |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display        | EB Garamond 500 (`--font-serif`)       | Hero headlines (46–88px, line-height 0.97), Studio page titles (every `h1` inside `.shell`), card headlines, big tile numbers, the welcome title |
| Section titles | Geist 500 with the fade (`.fade-text`) | 34–56px on the landing, 26px in the Studio; ink fading to gray, left to right                                                                    |
| Text and UI    | Geist 400/500 (`--font`)               | Body 16–19px / 1.5, captions 13–14px, buttons 15–16px / 500                                                                                      |

Captions lead with a bold phrase: "**Every claim links to a real post.** If a quote can't be traced…". Small uppercase labels: Geist 500, 12–13px, 0.14em tracking, `--slate`.

## Color

| Token                              | Value                               | Use                                                                                       |
| ---------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `--ink`                            | `#19191d`                           | text                                                                                      |
| `--muted` / `--text-3`             | `#6b6b7b` / `#9a9aab`               | secondary text, placeholders                                                              |
| `--primary` (= `--blue`, `--navy`) | `#1c38ea`                           | the main action, "Strong", selected chips, links                                          |
| `--glossy` + `--glossy-shadow`     | blue gradient with a soft highlight | **the one main action per screen** (`.glossy`, `.pill-dark`)                              |
| `--paper` / `--white`              | `#ffffff`                           | page and cards                                                                            |
| `--side`                           | `#f8f9fc`                           | the Studio sidebar                                                                        |
| `--gray`                           | `#f2f4f8`                           | quiet buttons, chips, the search field                                                    |
| `--line`                           | `#e9e9ef`                           | hairlines; cards use a 1px inset ring `#eceef4`                                           |
| `--tint`                           | `#eef1fb`                           | selected and "Saved" states                                                               |
| `--blue-card`                      | blue radial gradient                | one highlight card per row (the "Account" plan, "Rising this week", the "Strong" verdict) |
| `--mist`                           | pale gray-blue gradient             | the other cards in a row (steps, plans, tiles)                                            |
| `--sky-wash`                       | pale blue to white                  | behind the title on Home and the research start screen (`data-wash`)                      |
| `--early-*`                        | soft yellow                         | "Early signal" / "Sample", the only warning color                                         |

**The sky** (landing hero, welcome, closing): `#2c6ad6 → #4a8ae2 → #84b8ef → #bfdcf6 → white`, a warm sun glow low on the right, and a blurred cloud bank. It always fades into white; never a hard edge.

## Space and shape

4px base step. Landing sections 160px apart on desktop, 96px on phones; Studio sections 64px. Radius: 12px buttons and inputs, 10px small buttons and nav items, 18px the composer, 20px Studio cards, 24–28px landing cards and the sign-in card, chips fully round. Rings instead of borders; soft blue-tinted shadows only on floating things (nav, composer, preview, sheets).

## Landing

1. The nav: a floating, rounded bar of liquid glass (`components/motion/LiquidGlass.tsx`, after rdev/liquid-glass-react): clear over the sky, frosted white with dark text once the page scrolls. The rim bends what passes under it (Chromium) and catches the light toward the cursor; a glass bubble glides behind the current section's link. On phones the links open in a rounded glass sheet under the bar.
2. The sky hero: the serif headline, a shiny "Find your first idea" and a glass "See an example", then a real answer from the live feed in a frosted frame (question → verdict → headline → two ideas → "Validate in a day").
3. Sources strip.
4. How it works: three mist cards, each a 64px shiny blue icon tile, a short title and one line.
5. (Trust points now sit inside How it works.)
6. Pricing: a mist "Guest" card and a blue "Account" card.
7. FAQ.
8. The closing sky with the footer inside it.

The page canvas is deep sky, so the overscroll bounce never shows white. Copy is specific, with no invented numbers or testimonials.

## Entry flow

Landing CTAs → `/welcome`: the full-screen sky with a frosted white card in the middle (Password / Email link, then "or", then Continue as guest). → `/welcome/start` onboarding → Studio. Guests can use everything except Deep and Deepest research.

## Studio

- **Page:** white. Home and the research start screen have the sky wash under the title.
- **Top bar:** clear at the top, frosted white with a hairline once content scrolls under it.
- **Sidebar:** `--side` with a hairline; the active item is a white rounded rectangle that glides.
- **Cards:** white with a hairline ring, a category chip, a serif headline, one evidence line ("6 sources on 4 sites · Strong opportunity"), a small shiny Save and a "See ideas →" link.
- **Feed:** for inspiration, not only problems. Every third card is a real product that's working (`components/card/ProductCard.tsx`, data from `lib/products`): a blue "Working" chip, the name as the serif headline, one line on what it is, proof chips that link to their source ("$12k MRR, verified · TrustMRR", "#5 top-grossing in Finance · App Store"), and the shiny **Find its gaps** button that starts research on what its users complain about.
- **Tiles:** the first blue, the rest mist, with a big serif number.

## Rules

- One shiny blue action per card or screen; everything else is a quiet gray button or a blue text link.
- At most one meta line per card.
- Icons sit in shiny blue tiles only on the landing steps; elsewhere they're inline and quiet.

## Motion

Smooth, quick, never in the way. Only `transform` and `opacity` (plus `block-size` for folding).

- **Speeds:** 150ms press/hover (`--t-fast`), 250ms appear/move (`--t-med`), springs for sliders and sliding highlights. One easing: `--ease` (`cubic-bezier(.22,1,.36,1)`).
- **Entrances:** the `.rise` class (fade + 8px rise). Set `--i` on list items for a 40ms stagger (capped at 6). Page switches use `.fade-in`.
- **"You are here" backgrounds** glide between items with `components/motion/Highlight.tsx`.
- **Depth control:**
  - It works like ChatGPT's Thinking control: a pill in the composer (`DepthPicker`) opens a popover with the `DepthSlider`.
  - Guests see Deep and Deepest locked.
- **Dialogs and sheets** animate in and out with `@starting-style` + `allow-discrete`.
- **Reduced motion:** CSS animations are off in `globals.css`; `MotionProvider` sets `reducedMotion="user"`.
