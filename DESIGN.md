# Design system

Lane: dark cinema archive. Named reference: a streaming-service title page crossed with a case file.
Color strategy: Committed. One warm orange carries the decisions; everything else is a
blue-tinted near-black.

## Color (OKLCH, tinted neutrals, no pure black or white)
- ink-0  `oklch(14% 0.012 250)`  page ground (navy-black)
- ink-1  `oklch(18% 0.014 250)`  panels, cards, controls
- ink-2  `oklch(23% 0.016 250)`  raised panels, hover
- line   `oklch(100% 0 0 / 0.09)` borders
- paper  `oklch(96% 0.006 80)`   primary text (warm off-white)
- paper-2 `oklch(80% 0.01 80)`   secondary text
- mute   `oklch(62% 0.014 250)`  labels, meta
- ember  `oklch(70% 0.19 40)`    the accent: answer word, primary CTA, active states
- ember-deep `oklch(56% 0.19 35)` hover / pressed
- verdict colors: dies = ember; survives = `oklch(78% 0.13 150)` (sage green); complicated = mute

## Typography
- Display: Barlow Condensed 700/800, uppercase, tracking -0.01em, line-height 0.9 to 0.95.
- Text and UI: Barlow 400/500/600. One family, two widths. No serif, no mono.
- Scale (fluid): hero clamp(3.4rem, 9.5vw, 8rem); section h2 clamp(1.7rem, 3vw, 2.4rem);
  card title 1rem/600; meta 0.82rem; labels 0.72rem uppercase tracked 0.08em.
- Body max 68ch. Light-on-dark line-height 1.6.

## Surfaces and shape
- Radius: 6px controls, 10px panels, 12px spotlight.
- Panels: ink-1 fill + 1px line border. No side stripes, no glass, no gradient text.
- Elevation by fill step (ink-0 → ink-1 → ink-2), not by shadow. Shadows only under imagery.

## Components
- Wordmark: 28px square ember mark with a "?" + uppercase Barlow Condensed "DOES BRAD PITT DIE?"
  with DIE? in ember.
- Search: full-width ink-1 box, icon left, "/" key hint right.
- Spotlight: 16:6.4 panel, still with left-to-right ink scrim, kicker in ember, condensed title,
  ember primary button + outlined secondary, numbered dots bottom-right.
- Card: poster (2:3, radius 8) → title → meta → guess panel (ink-1 box: "Does he make it?",
  two ink-2 buttons) → after reveal: result panel with call + verdict word in verdict color.
- Curtains keep the signature reveal; colors follow the verdict.

## Motion
- Easing: cubic-bezier(.16,1,.3,1) (expo-out). Durations 300 to 900ms.
- One page-load stagger on the hero. Idle: spotlight Ken Burns only.
- Reduced motion disables everything but opacity.
