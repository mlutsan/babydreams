# Shadcn/UI Theme System

## Overview

We use shadcn/ui's comprehensive theme system with CSS custom properties (CSS variables) that automatically adapt between light and dark modes. All colors use the **OKLCH color space** for better perceptual uniformity.

## Available Colors

### Backgrounds
- `bg-background` - Main app background
- `bg-card` - Card/panel background
- `bg-popover` - Popover/dropdown background
- `bg-muted` - Muted/subtle background (headers, etc.)

### Text
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary/muted text
- `text-card-foreground` - Text on card backgrounds

### Interactive Elements
- `bg-primary` / `text-primary` - Primary action buttons
- `bg-secondary` / `text-secondary` - Secondary buttons
- `bg-accent` / `text-accent` - Accent/hover states
- `bg-destructive` / `text-destructive` - Delete/dangerous actions

### Borders & Inputs
- `border-border` - Standard borders
- `border-input` - Input field borders
- `ring-ring` - Focus ring color

## Before vs After

### ❌ Before (verbose, repetitive)
```tsx
<header className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
  <h1 className="text-gray-900 dark:text-gray-100">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</header>
```

### ✅ After (clean, semantic)
```tsx
<header className="bg-muted border-border">
  <h1 className="text-foreground">Title</h1>
  <p className="text-muted-foreground">Description</p>
</header>
```

## Usage Examples

### Layout
```tsx
// Background
<div className="bg-background">

// Card
<div className="bg-card text-card-foreground border border-border">

// Header/elevated surface
<header className="bg-muted">
```

### Typography
```tsx
// Main text
<h1 className="text-foreground">

// Secondary text
<p className="text-muted-foreground">

// Text on card
<Card>
  <p className="text-card-foreground">
</Card>
```

### Buttons
```tsx
<Button>                           // Uses bg-primary, text-primary-foreground
<Button variant="secondary">      // Uses bg-secondary
<Button variant="destructive">    // Uses bg-destructive (red)
<Button variant="outline">        // Uses border-input, hover:bg-accent
<Button variant="ghost">          // Uses hover:bg-accent
```

### Form Inputs
```tsx
<Input className="border-input bg-background text-foreground">
<Textarea className="border-input focus-visible:ring-ring">
```

## Benefits

✅ **Industry standard** - Uses shadcn/ui conventions
✅ **OKLCH colors** - Perceptually uniform color space
✅ **Comprehensive** - Covers all UI elements
✅ **No dark: prefixes** - Automatic theme switching
✅ **Single source of truth** - Change colors in one place
✅ **Easy theming** - Customize the entire app by updating variables

## Color Mapping (Old Custom → Shadcn Standard)

| Old (custom) | New (shadcn) | Purpose |
|---|---|---|
| `bg-background` | `bg-background` | ✓ Same |
| `bg-surface` | `bg-card` | Card backgrounds |
| `bg-surface-elevated` | `bg-muted` | Headers, nav |
| `text-text` | `text-foreground` | Primary text |
| `text-text-muted` | `text-muted-foreground` | Secondary text |
| `border-border` | `border-border` or `border-input` | Borders |

## Customizing Colors

To change the color scheme, edit `src/styles/app.css`:

```css
:root {
  --background: oklch(1 0 0);       /* Light mode: pure white */
  --foreground: oklch(0.141 0.005 285.823);  /* Light mode: dark text */
}

.dark {
  --background: oklch(0.141 0.005 285.823);  /* Dark mode: very dark */
  --foreground: oklch(0.985 0 0);            /* Dark mode: almost white */
}
```

The colors use **OKLCH format**: `oklch(lightness chroma hue)`
- Lightness: 0-1 (0 = black, 1 = white)
- Chroma: 0-0.4 (color intensity)
- Hue: 0-360 (color angle)

## Why OKLCH?

Unlike RGB/HSL, OKLCH is **perceptually uniform**:
- Equal lightness values look equally bright
- Smoother gradients
- Better accessibility
- More predictable color manipulation

Learn more: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
