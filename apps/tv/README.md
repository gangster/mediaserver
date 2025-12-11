# @mediaserver/tv

TV application for Android TV, Apple TV, and Fire TV.

## Development

```bash
# Android TV
yarn nx run @mediaserver/tv:android:tv

# Apple TV
yarn nx run @mediaserver/tv:ios:tv
```

## TV-Specific Features

### Focus Management

The TV app uses React Native's TV focus system with:
- Visible focus indicators (border/glow)
- Logical focus flow (D-pad navigation)
- Focus memory (return to last focused item)
- Focus trapping in modals

### Remote Control Mapping

- **D-pad**: Navigation
- **Select/OK**: Action
- **Back**: Go back / Exit modal
- **Play/Pause**: Toggle playback
- **Fast Forward/Rewind**: Seek
- **Menu**: Open options

### Layout Adaptations

- 1.5x font scaling for 10-foot UI
- 80px minimum touch targets
- Sidebar navigation (no bottom tabs)
- 5% safe area margins
- Simplified animations (no blur effects)

### Performance Considerations

- Fewer visible items (larger cards)
- Simple focus effects (border + subtle scale)
- Single video instance in memory
- Memory-aware image caching (50MB limit)

