/**
 * TypeStep - Step 1 of the Add Library Wizard
 *
 * Allows users to select the type of library (Movies or TV Shows).
 */

import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import type { LibraryType } from '../AddLibraryWizard';

const SM_BREAKPOINT = 640;

export interface TypeStepProps {
  /** Currently selected type */
  selectedType: LibraryType | null;
  /** Called when a type is selected */
  onSelect: (type: LibraryType) => void;
}

/**
 * Film icon for Movies card
 */
function FilmIcon({ selected }: { selected: boolean }) {
  return (
    <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke={selected ? '#818cf8' : '#a1a1aa'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
      </svg>
    </View>
  );
}

/**
 * TV icon for TV Shows card
 */
function TvIcon({ selected }: { selected: boolean }) {
  return (
    <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke={selected ? '#c084fc' : '#a1a1aa'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    </View>
  );
}

/**
 * Type selection card component
 */
function TypeCard({
  title,
  description,
  icon,
  isSelected,
  color,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  color: 'indigo' | 'purple';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 24,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: isSelected
          ? color === 'indigo'
            ? '#6366f1'
            : '#a855f7'
          : 'rgba(63, 63, 70, 0.8)',
        backgroundColor: isSelected
          ? color === 'indigo'
            ? 'rgba(99, 102, 241, 0.15)'
            : 'rgba(168, 85, 247, 0.15)'
          : 'rgba(39, 39, 42, 0.6)',
        alignItems: 'center',
        minWidth: 180,
      }}
    >
      {icon}
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: isSelected
              ? color === 'indigo'
                ? '#a5b4fc'
                : '#d8b4fe'
              : '#f4f4f5',
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: '#71717a',
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>
      {isSelected && (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: color === 'indigo' ? '#6366f1' : '#a855f7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </View>
      )}
    </Pressable>
  );
}

/**
 * TypeStep component
 */
export function TypeStep({ selectedType, onSelect }: TypeStepProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < SM_BREAKPOINT;

  return (
    <View>
      <View
        style={{
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
        }}
      >
        <TypeCard
          title="Movies"
          description="Feature films and standalone videos"
          icon={<FilmIcon selected={selectedType === 'movie'} />}
          isSelected={selectedType === 'movie'}
          color="indigo"
          onPress={() => onSelect('movie')}
        />
        <TypeCard
          title="TV Shows"
          description="Series with episodes and seasons"
          icon={<TvIcon selected={selectedType === 'tv'} />}
          isSelected={selectedType === 'tv'}
          color="purple"
          onPress={() => onSelect('tv')}
        />
      </View>
    </View>
  );
}

export default TypeStep;
