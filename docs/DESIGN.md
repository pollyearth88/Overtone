# Overtone — Design system

The reference implementation of the Design system section of [SPEC.md](./SPEC.md).
Light is the locked cream + navy palette. Dark is the spec's proposal and can be
tuned now that it runs.

Tokens live in one place: `src/app/globals.css`. Nothing else hard-codes a colour.

## Tokens

| Token           | Role                                       | Light     | Dark      |
| --------------- | ------------------------------------------ | --------- | --------- |
| `bg`            | App background                             | `#F7F3EA` | `#14171C` |
| `surface`       | Cards and panels                           | `#FFFCF7` | `#1C2027` |
| `primary`       | Buttons, headings, selected, progress      | `#183153` | `#8FB0DA` |
| `primary-fg`    | Text and icons on `primary`                | `#FFFCF7` | `#14171C` |
| `accent`        | Streak flame, combo, logo dot (marks only) | `#B8654B` | `#D98A6F` |
| `accent-strong` | Accent used as a _text_ background         | `#A65B44` | `#D98A6F` |
| `accent-fg`     | Text on `accent-strong`                    | `#FFFCF7` | `#14171C` |
| `text`          | Body text                                  | `#292D33` | `#EDE8DE` |
| `muted`         | Secondary text                             | `#6B655C` | `#A39C90` |
| `border`        | Borders and dividers                       | `#DDD6CA` | `#2E333B` |
| `track`         | Empty progress bars, waveform              | `#E6DFD2` | `#2A2F37` |
| `success`       | Correct answer                             | `#2F6B4A` | `#5FB383` |
| `success-tint`  | Correct answer background                  | `#E7F0E8` | `#17291F` |
| `danger`        | Wrong answer                               | `#A8322D` | `#E07A6E` |
| `danger-tint`   | Wrong answer background                    | `#F6E4E1` | `#2C1B1A` |

`primary-fg`, `accent-fg`, `success-tint` and `danger-tint` are additions to the
spec's table — the spec gives the tints in its `success`/`danger` rows and names
`#14171C` as the text colour on dark `primary`; these just give them token names.

`accent-strong` is a real deviation, for the same reason the spec already
darkened `muted`: `#FFFCF7` on the spec's `#B8654B` measures **4.10:1**, under
the 4.5:1 floor. `#A65B44` is the same hue darkened 10% and measures 4.88:1.
Use `accent` for icons and marks (3:1 applies), `accent-strong` whenever accent
is behind text. Dark mode needs no change, so both tokens share `#D98A6F`.

Run `pnpm contrast` to re-measure every text pair; it is part of CI. Changing a
token without running it is how the floor quietly breaks.

## How theming works

1. `@theme` in `globals.css` declares the light values. Tailwind emits them on
   `:root` and registers each one, so `bg-bg`, `text-muted`, `border-border`,
   `bg-success-tint` and so on all exist.
2. `[data-theme='dark']` re-binds the same custom properties. Every utility
   compiles to `var(--color-*)`, so the whole UI re-themes with no `dark:`
   variants in component code.
3. `next-themes` writes `data-theme` on `<html>`, defaulting to `system`.
   Settings overrides it. The `dark:` variant is remapped to the attribute so a
   manual choice beats the OS setting.

Adding a colour means adding a token in both blocks and a row above — never a
hex value in a component.

## Type

- **Space Grotesk** (`font-sans`, the default) — UI and headings.
- **JetBrains Mono** (`font-mono`) — labels, levels, timers, stats, scores,
  chips. Anything numeric or label-like.

Both load through `next/font/google` in `src/app/layout.tsx`, which sets
`--font-space-grotesk` and `--font-jetbrains-mono`.

## Shape and spacing

- `rounded-card` (20px) — cards and panels.
- `rounded-control` (14px) — buttons and inputs.
- `rounded-full` — chips, pills, avatars, progress bars.
- App column: 390px design width, `max-w-[480px]` centred on desktop, 16px gutters.

## Rules

- **Touch:** every interactive target is at least 44px (`min-h-11` / `size-11`).
- **Never colour alone:** correct and wrong states always pair the colour with an
  icon and text (`CheckIcon` + "3 — Mi", `XIcon` + the replayed answer).
- **Contrast:** every text pair holds at least 4.5:1 in both themes, verified by
  `pnpm contrast`. Note two traps it caught: `muted` on `track` is only 4.35:1
  (so chips use `text-text`), and `accent-fg` on plain `accent` is 4.10:1 (so
  text-bearing accent surfaces use `accent-strong`).
- **Motion:** short, subtle transitions (150–300ms). The global
  `prefers-reduced-motion` block in `globals.css` reduces them to near zero —
  don't bypass it with inline animation.
- **Focus:** a 2px `primary` ring on `:focus-visible`, set globally. Don't remove it.
- **Icons:** inline SVG from `src/components/ui/icons.tsx`, `aria-hidden`, with
  the accessible name on the surrounding button or link. No emoji.

## Components

`src/components/ui/` holds the design-system pieces: `Button` (primary, outline,
ghost), `Card` (surface, primary), `Chip` (default, accent, onPrimary),
`ProgressBar`, `StatPill`, `IconButton` (label required) and `TabBar`.
Screen-specific composites live beside the screen, e.g. `src/components/home/`.
