# Cross-Platform UX Guidelines

This document outlines UX patterns and architectural decisions for ensuring mediaserver works seamlessly across Web, iOS, Android, and TV platforms.

---

## Current State Assessment

### ✅ What's Already Good

1. **Platform Detection** (`packages/ui/src/utils/platform.ts`)
   - `isTV()`, `isMobile()`, `isWeb()`, `platformSelect()` utilities
   - Ready for conditional rendering/styling

2. **TV-Aware Design Tokens** (`packages/ui/src/theme/`)
   - `tvFontSize` - 1.5x scaled typography for 10-foot UI
   - `tvSafeArea` - 5% margins for overscan
   - `touchTarget.tv` - 80px minimum for D-pad navigation

3. **Responsive Layouts**
   - Using `useWindowDimensions()` for responsive design
   - `isDesktop` breakpoints in pages

### ⚠️ Gaps to Address

1. **Component Location** - Most components in `apps/web/src/components` won't be shared
2. **Focus States** - No visible focus indicators for keyboard/TV navigation
3. **Hardcoded Styles** - Many inline styles instead of theme tokens
4. **No Haptic Feedback** - Missing tactile feedback for mobile
5. **No TV Navigation System** - No focus management for D-pad

---

## Architectural Recommendations

### 1. Component Migration Strategy

**Principle**: Components that work across platforms should live in `@mediaserver/ui`.

```
@mediaserver/ui/src/components/
├── primitives/           # Base components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Toggle.tsx
│   └── Text.tsx
├── feedback/             # User feedback
│   ├── Spinner.tsx
│   ├── Toast.tsx
│   └── ProgressBar.tsx
├── media/                # Media-specific (high reuse)
│   ├── MediaCard.tsx
│   ├── EpisodeCard.tsx
│   ├── CastCard.tsx
│   ├── RatingBadge.tsx
│   └── TrackSelector.tsx
├── navigation/           # Platform-aware navigation
│   ├── TabBar.tsx
│   ├── FocusableView.tsx
│   └── ScrollContainer.tsx
└── layout/
    ├── SafeAreaView.tsx
    └── Grid.tsx
```

**Keep in app-specific folders:**
- Platform-specific navigation (Sidebar for web, BottomNav for mobile)
- Page layouts
- Complex forms with platform-specific UX

### 2. Focus Management System

**Critical for TV.** Create a focus management hook:

```tsx
// @mediaserver/ui/src/hooks/useFocusable.ts
import { useRef, useCallback, useEffect } from 'react';
import { findNodeHandle, AccessibilityInfo } from 'react-native';
import { isTV } from '../utils/platform';

export function useFocusable(options?: {
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const ref = useRef(null);
  
  const focus = useCallback(() => {
    if (ref.current) {
      const node = findNodeHandle(ref.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }
  }, []);

  // Auto-focus on mount for TV
  useEffect(() => {
    if (isTV() && options?.autoFocus) {
      focus();
    }
  }, []);

  return { ref, focus };
}
```

### 3. Focusable Wrapper Component

All interactive elements need visible focus states:

```tsx
// @mediaserver/ui/src/components/FocusableView.tsx
import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { isTV } from '../utils/platform';

export function FocusableView({ 
  children, 
  onPress,
  focusScale = 1.05,
  focusBorderColor = '#818cf8',
  ...props 
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.container,
        isFocused && styles.focused,
        isFocused && { borderColor: focusBorderColor },
        isTV() && isFocused && { transform: [{ scale: focusScale }] },
        pressed && styles.pressed,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  focused: {
    borderColor: '#818cf8',
  },
  pressed: {
    opacity: 0.9,
  },
});
```

---

## Immediate Action Items

### Priority 1: Focus States (Do Now)

Every interactive element needs a visible focus state. This is critical for:
- TV D-pad navigation
- Keyboard navigation on web
- Accessibility (screen readers)

**Pattern to apply everywhere:**

```tsx
<Pressable
  style={({ focused, pressed }) => [
    styles.button,
    focused && styles.buttonFocused,  // Add this!
    pressed && styles.buttonPressed,
  ]}
>
```

**Focus style pattern:**
```tsx
buttonFocused: {
  borderWidth: 3,
  borderColor: '#818cf8',
  // On TV, also scale up slightly
  ...(isTV() && { transform: [{ scale: 1.05 }] }),
}
```

### Priority 2: Touch Target Audit

Use the theme's `touchTarget` values:

```tsx
import { touchTarget, platformSelect } from '@mediaserver/ui';

const minHeight = platformSelect({
  mobile: touchTarget.mobile,  // 44
  tv: touchTarget.tv,          // 80
  default: 48,
});
```

**Minimum sizes:**
| Platform | Min Touch Target |
|----------|------------------|
| Mobile   | 44x44px         |
| TV       | 80x80px         |
| Web      | 48px height     |

### Priority 3: Safe Area Handling

```tsx
// Use SafeAreaView from react-native-safe-area-context
import { SafeAreaView } from 'react-native-safe-area-context';
import { tvSafeArea, isTV } from '@mediaserver/ui';

function Layout({ children }) {
  return (
    <SafeAreaView 
      style={[
        styles.container,
        isTV() && { 
          paddingHorizontal: tvSafeArea.horizontal,
          paddingVertical: tvSafeArea.vertical,
        }
      ]}
    >
      {children}
    </SafeAreaView>
  );
}
```

### Priority 4: Standardize Spacing

Replace hardcoded values with theme tokens:

```tsx
// ❌ Bad
style={{ padding: 24, marginBottom: 16 }}

// ✅ Good
import { spacing } from '@mediaserver/ui';
style={{ padding: spacing[6], marginBottom: spacing[4] }}
```

---

## Platform-Specific Considerations

### TV (tvOS, Android TV, Fire TV)

1. **10-Foot UI**: Everything 1.5-2x larger
2. **D-Pad Navigation**: Up/Down/Left/Right/Select/Back
3. **No Touch**: Focus-based interaction only
4. **No Hover**: Only focus and select states
5. **Safe Areas**: 5% margins for overscan
6. **Limited Text Input**: Minimize typing, use voice search

**TV-specific patterns:**
- Focus rings on all interactive elements
- Larger cards with more spacing
- Simplified navigation (fewer nested menus)
- Auto-play previews on focus (with delay)

### Mobile (iOS, Android)

1. **Touch Gestures**: Swipe, pinch, long-press
2. **Pull-to-Refresh**: Expected on lists
3. **Haptic Feedback**: For confirmations
4. **Bottom Navigation**: Thumb-friendly
5. **Platform Conventions**: iOS vs Android patterns

**Mobile-specific patterns:**
- Swipe actions on list items
- Floating action buttons
- Gesture-based navigation
- Native share sheets

### Web

1. **Keyboard Shortcuts**: Cmd+K for search, Space for play, etc.
2. **Hover States**: Additional feedback layer
3. **Right-Click Menus**: Context menus
4. **Wide Screens**: Multi-column layouts

**Web-specific patterns:**
- Keyboard shortcuts overlay
- Hover previews
- Sidebar navigation on desktop
- Bottom nav on mobile web

---

## Component Checklist

Before shipping a component, verify:

- [ ] **Focus State**: Visible border/outline when focused
- [ ] **Touch Target**: Minimum 44px mobile, 80px TV
- [ ] **Keyboard Accessible**: Can tab to and activate with Enter/Space
- [ ] **Screen Reader**: Proper accessibility labels
- [ ] **Loading State**: Shows spinner/skeleton when loading
- [ ] **Error State**: Graceful error handling
- [ ] **Platform Scaling**: Uses theme tokens, not hardcoded sizes
- [ ] **Dark/Light Mode**: Works in both (if applicable)

---

## Migration Path

### Phase 1: Foundation (Now)
1. Add focus states to all Pressable components
2. Audit touch targets
3. Create `FocusableView` wrapper

### Phase 2: Shared Components (Before Mobile Launch)
1. Move `TrackSelector` to `@mediaserver/ui`
2. Move `MediaCard` variants to shared package
3. Move `RatingBadge` to shared package
4. Create shared `SettingsToggle` component

### Phase 3: TV-Specific (Before TV Launch)
1. Implement TV navigation system
2. Add focus memory (remember last focused item)
3. TV-specific layouts
4. Voice search integration

---

## Testing Checklist

### Keyboard Navigation (Web)
- [ ] Can tab through all interactive elements
- [ ] Focus order is logical
- [ ] Focus visible at all times
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals

### Screen Reader (All Platforms)
- [ ] All images have alt text
- [ ] Buttons have accessible labels
- [ ] Forms have proper labels
- [ ] Loading states announced
- [ ] Page changes announced

### TV Remote (TV Apps)
- [ ] D-pad navigates all elements
- [ ] Focus visible and scaled
- [ ] Back button works correctly
- [ ] No dead ends in navigation
- [ ] Fast navigation (no lag)

