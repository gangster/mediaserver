/**
 * FocusableView Component
 *
 * A wrapper that provides visible focus states for keyboard and TV navigation.
 * Use this to wrap any interactive content that needs focus indication.
 *
 * Critical for:
 * - TV D-pad navigation
 * - Keyboard accessibility on web
 * - Screen reader users
 *
 * @example
 * <FocusableView onPress={() => navigate('/movies/1')}>
 *   <MovieCard movie={movie} />
 * </FocusableView>
 */

import { useState, useRef, useCallback, forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { isTV, isMobile } from '../utils/platform.js';
import { touchTarget } from '../theme/spacing.js';

export interface FocusableViewProps extends Omit<PressableProps, 'style'> {
  /** Content to render inside */
  children: React.ReactNode;
  /** Scale factor when focused on TV (default: 1.05) */
  focusScale?: number;
  /** Border color when focused (default: #818cf8) */
  focusBorderColor?: string;
  /** Border width when focused (default: 3) */
  focusBorderWidth?: number;
  /** Border radius (default: 12) */
  borderRadius?: number;
  /** Additional styles */
  style?: ViewStyle;
  /** Whether to auto-focus on mount (TV only) */
  autoFocus?: boolean;
  /** Callback when focused */
  onFocusChange?: (focused: boolean) => void;
  /** Disable focus scaling animation */
  disableScaleAnimation?: boolean;
  /** Override minimum touch target */
  minTouchTarget?: number;
}

export const FocusableView = forwardRef<typeof Pressable, FocusableViewProps>(
  function FocusableView(
    {
      children,
      focusScale = 1.05,
      focusBorderColor = '#818cf8',
      focusBorderWidth = 3,
      borderRadius = 12,
      style,
      autoFocus: _autoFocus = false,
      onFocusChange,
      onPress,
      disableScaleAnimation = false,
      minTouchTarget,
      disabled,
      ...props
    },
    forwardedRef
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const innerRef = useRef<typeof Pressable>(null);
    const ref = (forwardedRef as React.RefObject<typeof Pressable>) || innerRef;

    // Determine minimum touch target based on platform
    const minHeight = minTouchTarget ?? (isTV() ? touchTarget.tv : isMobile() ? touchTarget.mobile : 48);

    // Handle focus
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocusChange?.(true);

      // Scale animation for TV
      if (isTV() && !disableScaleAnimation) {
        Animated.spring(scaleAnim, {
          toValue: focusScale,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }).start();
      }
    }, [scaleAnim, focusScale, onFocusChange, disableScaleAnimation]);

    // Handle blur
    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onFocusChange?.(false);

      if (isTV() && !disableScaleAnimation) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }).start();
      }
    }, [scaleAnim, onFocusChange, disableScaleAnimation]);

    // Programmatic focus (useful for TV)
    // Note: Keeping this for future use when auto-focus is enabled
    // const focus = useCallback(() => {
    //   if (ref.current) {
    //     const node = findNodeHandle(ref.current as any);
    //     if (node) {
    //       AccessibilityInfo.setAccessibilityFocus(node);
    //     }
    //   }
    // }, [ref]);

    const containerStyle: ViewStyle = {
      borderRadius,
      borderWidth: focusBorderWidth,
      borderColor: isFocused ? focusBorderColor : 'transparent',
      minHeight,
      overflow: 'hidden',
    };

    // Use Animated.View wrapper for TV scale animation
    if (isTV() && !disableScaleAnimation) {
      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            ref={ref as any}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPress={onPress}
            disabled={disabled}
            style={[containerStyle, style]}
            accessible
            {...props}
          >
            {children}
          </Pressable>
        </Animated.View>
      );
    }

    return (
      <Pressable
        ref={ref as any}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.pressed,
          style,
        ]}
        accessible
        {...props}
      >
        {children}
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
});

export default FocusableView;

