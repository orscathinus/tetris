# Tetris // Afterdark

A polished, fully playable browser Tetris game with a neon midnight-arcade interface.

## Play

The hosted game is available at:

https://tetris-arcade.thirtytwo32percent.chatgpt.site

## Features

- Standard 10 × 20 playfield
- Seven-bag piece randomization
- Next-piece queue and hold slot
- Ghost-piece landing preview
- Soft drop and hard drop scoring
- Line clears, levels, and increasing fall speed
- Pause, restart, and game-over states
- Device-local high-score saving
- Keyboard and touch-friendly controls
- Responsive desktop and mobile layout
- Reduced-motion accessibility support

## Controls

| Action | Key |
| --- | --- |
| Move | Left / Right arrows |
| Soft drop | Down arrow |
| Rotate clockwise | Up arrow or X |
| Hard drop | Space |
| Hold | C or Shift |
| Pause / resume | P or Escape |
| Start from idle | Enter or Space |

The on-screen control buttons also work with mouse and touch input.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Then open the local address printed by the development server.

## Validate a production build

```bash
npm test
```

This project uses React, TypeScript, Vinext, Vite, and Cloudflare-compatible server output.

> This is an unofficial block-stacking game created for demonstration and personal use.
