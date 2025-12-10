# Nuxt 4 + Nuxt UI 4 Reference

This project uses **Nuxt 4** and **Nuxt UI 4** (not Nuxt 3/UI 3).

## Custom Colors (from app.config.ts)

The following colors are configured in `app/app.config.ts`:

| Color | Tailwind Color |
|-------|---------------|
| `primary` | pink |
| `secondary` | purple |
| `tertiary` | amber |
| `info` | sky |
| `success` | emerald |
| `warning` | yellow |
| `error` | red |
| `neutral` | neutral |

## Valid Component Colors

When using Nuxt UI components, use these colors:
- `primary`, `secondary`, `tertiary` (custom)
- `info`, `success`, `warning`, `error`  
- `neutral`

### Common Mistakes

| Wrong | Correct | Notes |
|-------|---------|-------|
| `color="red"` | `color="error"` | Use semantic colors |
| `color="gray"` | `color="neutral"` | Use neutral for grays |
| `color="white"` | `color="neutral"` | Or use class for white |
| `color="ghost"` | `variant="ghost"` | ghost is a VARIANT, not color |

## Button Variants

Valid variants: `solid`, `outline`, `soft`, `subtle`, `ghost`, `link`

## TypeScript Note

If TypeScript complains about `tertiary` not being a valid color, it's because the generated `.nuxt/types` don't include custom colors. Run `npx nuxi prepare` to regenerate types, or use type assertion where needed.
