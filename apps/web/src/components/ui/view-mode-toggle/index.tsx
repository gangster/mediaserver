/**
 * ViewModeToggle component
 *
 * Toggle buttons for switching between different view modes (poster, list, etc.)
 * Adapted for React Native Web.
 */

import { useState } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

/** Standard view mode options */
export type ViewMode = 'poster' | 'posterCard' | 'list' | 'thumb' | 'thumbCard' | 'banner';

export interface ViewModeToggleProps {
  /** Currently active mode */
  activeMode: ViewMode;
  /** Called when mode changes */
  onModeChange: (mode: ViewMode) => void;
  /** Available modes (defaults to all 6) */
  modes?: ViewMode[];
}

/** View mode labels for tooltips */
const viewModeLabels: Record<ViewMode, string> = {
  poster: 'Poster',
  posterCard: 'Poster Card',
  list: 'List',
  thumb: 'Thumbnail',
  thumbCard: 'Thumbnail Card',
  banner: 'Banner',
};

/** Default order of view modes */
const defaultModes: ViewMode[] = ['poster', 'posterCard', 'list', 'thumb', 'thumbCard', 'banner'];

/** View mode icon component */
function ViewModeIcon({ mode, color, size = 20 }: { mode: ViewMode; color: string; size?: number }) {
  switch (mode) {
    case 'poster':
      return <Ionicons name="grid-outline" size={size} color={color} />;
    case 'posterCard':
      return <Ionicons name="albums-outline" size={size} color={color} />;
    case 'list':
      return <Feather name="list" size={size} color={color} />;
    case 'thumb':
      return <Ionicons name="apps-outline" size={size} color={color} />;
    case 'thumbCard':
      return <Ionicons name="layers-outline" size={size} color={color} />;
    case 'banner':
      return (
        <Feather
          name="sidebar"
          size={size}
          color={color}
          style={{ transform: [{ rotate: '90deg' }] }}
        />
      );
    default:
      return <Ionicons name="grid-outline" size={size} color={color} />;
  }
}

/** Single toggle button with tooltip */
function ToggleButton({
  mode,
  isActive,
  onPress,
}: {
  mode: ViewMode;
  isActive: boolean;
  onPress: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={[
          {
            padding: 8,
            borderRadius: 6,
            backgroundColor: isActive ? '#10b981' : isHovered ? '#3f3f46' : 'transparent',
            transitionProperty: 'background-color',
            transitionDuration: '150ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          } as ViewStyle,
        ]}
      >
        <ViewModeIcon
          mode={mode}
          color={isActive ? '#fff' : isHovered ? '#fff' : '#71717a'}
        />
      </Pressable>

      {/* Tooltip */}
      {isHovered && (
        <View
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: [{ translateX: -50 }],
            marginBottom: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: '#18181b',
            borderWidth: 1,
            borderColor: '#3f3f46',
            borderRadius: 6,
            zIndex: 50,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          } as ViewStyle}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 12,
            }}
            numberOfLines={1}
          >
            {viewModeLabels[mode]}
          </Text>
          {/* Arrow */}
          <View
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: -4,
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 4,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: '#18181b',
            }}
          />
        </View>
      )}
    </View>
  );
}

/**
 * View mode toggle buttons
 */
export function ViewModeToggle({
  activeMode,
  onModeChange,
  modes = defaultModes,
}: ViewModeToggleProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        backgroundColor: '#27272a',
        borderRadius: 8,
      }}
    >
      {modes.map((mode) => (
        <ToggleButton
          key={mode}
          mode={mode}
          isActive={activeMode === mode}
          onPress={() => onModeChange(mode)}
        />
      ))}
    </View>
  );
}

export default ViewModeToggle;
