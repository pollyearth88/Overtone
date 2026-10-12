/**
 * Checks the token pairs that carry text against WCAG AA (4.5:1 for body text,
 * 3:1 for large text). Run with `node scripts/check-contrast.mjs`.
 *
 * Keep this in sync with docs/DESIGN.md whenever a token changes.
 */

const LIGHT = {
  bg: '#F7F3EA',
  surface: '#FFFCF7',
  primary: '#183153',
  primaryFg: '#FFFCF7',
  accent: '#B8654B',
  accentStrong: '#A65B44',
  accentFg: '#FFFCF7',
  text: '#292D33',
  muted: '#6B655C',
  border: '#DDD6CA',
  track: '#E6DFD2',
  success: '#2F6B4A',
  successTint: '#E7F0E8',
  danger: '#A8322D',
  dangerTint: '#F6E4E1',
};

const DARK = {
  bg: '#14171C',
  surface: '#1C2027',
  primary: '#8FB0DA',
  primaryFg: '#14171C',
  accent: '#D98A6F',
  accentStrong: '#D98A6F',
  accentFg: '#14171C',
  text: '#EDE8DE',
  muted: '#A39C90',
  border: '#2E333B',
  track: '#2A2F37',
  success: '#5FB383',
  successTint: '#17291F',
  danger: '#E07A6E',
  dangerTint: '#2C1B1A',
};

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Flatten a translucent foreground over an opaque background. */
function blend(fgHex, bgHex, alpha) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const mixed = fg.map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function ratio(aHex, bHex) {
  const a = luminance(aHex);
  const b = luminance(bHex);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** [description, foreground, background, minimum] */
function pairsFor(t) {
  return [
    ['body text on bg', t.text, t.bg, 4.5],
    ['body text on surface', t.text, t.surface, 4.5],
    ['muted on bg', t.muted, t.bg, 4.5],
    ['muted on surface', t.muted, t.surface, 4.5],
    ['chip text on track', t.text, t.track, 4.5],
    ['primary on bg', t.primary, t.bg, 4.5],
    ['primary on surface', t.primary, t.surface, 4.5],
    ['primary-fg on primary', t.primaryFg, t.primary, 4.5],
    ['primary-fg 80% on primary', blend(t.primaryFg, t.primary, 0.8), t.primary, 4.5],
    ['accent-fg on accent-strong (chip)', t.accentFg, t.accentStrong, 4.5],
    ['primary on primary-fg (daily button)', t.primary, t.primaryFg, 4.5],
    ['success on success-tint', t.success, t.successTint, 4.5],
    ['danger on danger-tint', t.danger, t.dangerTint, 4.5],
    // Large/non-text: the logo dot and streak flame are icons, 3:1 applies.
    ['accent on bg (icon)', t.accent, t.bg, 3],
    ['accent on surface (icon)', t.accent, t.surface, 3],
    ['border on bg (divider)', t.border, t.bg, 1],
  ];
}

let failures = 0;

for (const [themeName, tokens] of [
  ['light', LIGHT],
  ['dark', DARK],
]) {
  console.log(`\n${themeName}`);
  for (const [label, fg, bg, min] of pairsFor(tokens)) {
    const value = ratio(fg, bg);
    const ok = value >= min;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${value.toFixed(2)}:1  (min ${min})  ${label}  ${fg} on ${bg}`,
    );
  }
}

console.log(`\n${failures === 0 ? 'All pairs pass.' : `${failures} pair(s) below target.`}`);
process.exit(failures === 0 ? 0 : 1);
