/**
 * Empty State Component
 *
 * Displayed when no libraries exist.
 */

import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  onAddLibrary: () => void;
}

export function EmptyState({ onAddLibrary }: EmptyStateProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 640;

  return (
    <View style={{ padding: 32 }}>
      <View style={{ alignItems: 'center', paddingVertical: 64, maxWidth: 512, marginHorizontal: 'auto' }}>
        {/* Icon */}
        <View style={{ position: 'relative', marginBottom: 32 }}>
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="folder" size={56} color="#818cf8" />
            </View>
          </View>
          {/* Plus badge */}
          <View
            style={{
              position: 'absolute',
              right: -4,
              top: -4,
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#6366f1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="plus" size={22} color="#ffffff" />
          </View>
        </View>

        {/* Content */}
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 12, textAlign: 'center' }}>
          No libraries yet
        </Text>
        <Text style={{ color: '#a1a1aa', marginBottom: 32, textAlign: 'center', maxWidth: 360, lineHeight: 22 }}>
          Libraries tell Mediaserver where to find your movies and TV shows. Add your first library to start building
          your collection.
        </Text>

        {/* CTA */}
        <Pressable
          onPress={onAddLibrary}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 24,
            paddingVertical: 14,
            backgroundColor: '#6366f1',
            borderRadius: 12,
          }}
        >
          <Feather name="plus" size={20} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>Add Your First Library</Text>
        </Pressable>

        {/* Help cards */}
        <View
          style={{
            marginTop: 48,
            flexDirection: isSmall ? 'column' : 'row',
            gap: 16,
            width: '100%',
          }}
        >
          <View
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 12,
              backgroundColor: 'rgba(24, 24, 27, 0.5)',
              borderWidth: 1,
              borderColor: '#27272a',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <MaterialCommunityIcons name="movie-open" size={22} color="#818cf8" />
            </View>
            <Text style={{ color: '#ffffff', fontWeight: '600', marginBottom: 4 }}>Movies</Text>
            <Text style={{ color: '#71717a', fontSize: 14 }}>Point to a folder with your movie files</Text>
          </View>

          <View
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 12,
              backgroundColor: 'rgba(24, 24, 27, 0.5)',
              borderWidth: 1,
              borderColor: '#27272a',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: 'rgba(147, 51, 234, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="tv" size={22} color="#a855f7" />
            </View>
            <Text style={{ color: '#ffffff', fontWeight: '600', marginBottom: 4 }}>TV Shows</Text>
            <Text style={{ color: '#71717a', fontSize: 14 }}>Point to a folder with your TV series</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
