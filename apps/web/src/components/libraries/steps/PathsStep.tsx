/**
 * PathsStep - Step 3 of the Add Library Wizard
 *
 * Allows users to add folder paths for their library.
 */

import { View, Text, Pressable, ScrollView } from 'react-native';
import { PathInput } from '../PathInput';

export interface PathsStepProps {
  /** Current list of paths */
  paths: string[];
  /** Called when paths change */
  onChange: (paths: string[]) => void;
}

/**
 * PathsStep component
 */
export function PathsStep({ paths, onChange }: PathsStepProps) {
  // Update a specific path
  const updatePath = (index: number, value: string) => {
    const newPaths = [...paths];
    newPaths[index] = value;
    onChange(newPaths);
  };

  // Remove a path
  const removePath = (index: number) => {
    const newPaths = paths.filter((_, i) => i !== index);
    // Ensure at least one path input
    onChange(newPaths.length > 0 ? newPaths : ['']);
  };

  // Add a new path input
  const addPath = () => {
    onChange([...paths, '']);
  };

  // Get other paths for duplicate detection
  const getOtherPaths = (currentIndex: number): string[] => {
    return paths
      .filter((_, i) => i !== currentIndex)
      .map((p) => p.trim())
      .filter((p) => p !== '');
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 14, color: '#a1a1aa', textAlign: 'center', marginBottom: 8 }}>
        Add the folder paths that contain your media files.
      </Text>

      <ScrollView
        style={{ maxHeight: 250 }}
        contentContainerStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {paths.map((path, index) => (
          <PathInput
            key={index}
            value={path}
            onChange={(value) => updatePath(index, value)}
            onRemove={() => removePath(index)}
            canRemove={paths.length > 1}
            otherPaths={getOtherPaths(index)}
            autoFocus={index === 0 && paths.length === 1}
            placeholder={index === 0 ? '/media/movies' : '/path/to/media'}
          />
        ))}
      </ScrollView>

      {/* Add another path button */}
      <Pressable
        onPress={addPath}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(63, 63, 70, 0.5)',
          backgroundColor: 'rgba(39, 39, 42, 0.3)',
        }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#71717a"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <Text style={{ fontSize: 14, color: '#71717a' }}>Add Another Path</Text>
      </Pressable>

      {/* Help text */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 12,
          backgroundColor: 'rgba(63, 63, 70, 0.2)',
          borderRadius: 8,
        }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#71717a"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginTop: 2 }}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 18 }}>
            Tip: Add paths to directories containing your media files. The scanner will search
            these folders for movies or TV shows.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default PathsStep;
