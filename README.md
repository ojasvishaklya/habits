# Habits

A mobile-first PWA for tracking daily habits via a visual date matrix.

## Features

- **Grid view** — scrollable year matrix; each tile = one day, color-coded dots show completed habits
- **Habit management** — add/edit/delete habits with a custom name, color, and icon
- **Day log** — tap any tile to check off which habits you completed that day
- **Stats** — streak tracking, monthly completion rate, per-habit sparklines
- **Offline** — service worker caches all assets for full offline use
- **Installable** — PWA manifest for home screen install on iOS and Android

## Stack

Vanilla HTML / CSS / JS · Bootstrap 5.3 · Bootstrap Icons · `localStorage` for persistence

## Run locally

```bash
cd habit-tracker
python3 -m http.server 3000
# open http://localhost:3000
```

## Data

Export and import your data as JSON via the **More** menu. No backend, no accounts.
