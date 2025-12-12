/**
 * Library Management Page
 */

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLibraries } from '@mediaserver/api-client';
import { trpc } from '@mediaserver/api-client';
import { Layout } from '../src/components/layout';
import { LibraryCard } from '../src/components/libraries/LibraryCard';
import { LibraryForm } from '../src/components/libraries/LibraryForm';
import { EmptyState } from '../src/components/libraries/EmptyState';

export interface Library {
  id: string;
  name: string;
  type: 'movie' | 'tv';
  paths: string[] | string; // May be JSON string from DB or parsed array
  enabled: boolean;
  lastScannedAt: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function LibrariesPage() {
  const { width } = useWindowDimensions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);

  const { data: libraries, isLoading, error, refetch } = useLibraries();

  const scanAllMutation = trpc.libraries.scanAll.useMutation({
    onSuccess: () => refetch(),
  });

  const handleAddLibrary = () => {
    setEditingLibrary(null);
    setIsFormOpen(true);
  };

  const handleEditLibrary = (library: Library) => {
    setEditingLibrary(library);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingLibrary(null);
  };

  const handleFormSuccess = () => {
    handleCloseForm();
    refetch();
  };

  // Grid columns
  const columns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;
  const gap = 24;
  const itemWidth = columns === 1 ? '100%' : `calc(${100 / columns}% - ${(gap * (columns - 1)) / columns}px)`;

  // Loading
  if (isLoading) {
    return (
      <Layout>
        <View style={{ padding: 32 }}>
          <View style={{ height: 32, backgroundColor: '#27272a', borderRadius: 8, width: 200, marginBottom: 32 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {[1, 2, 3].map((i) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <View key={i} style={{ height: 200, backgroundColor: '#27272a', borderRadius: 12, width: itemWidth } as any} />
            ))}
          </View>
        </View>
      </Layout>
    );
  }

  // Error
  if (error) {
    return (
      <Layout>
        <View style={{ padding: 32 }}>
          <View
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: 32,
              alignItems: 'center',
            }}
          >
            <Feather name="alert-circle" size={48} color="#f87171" style={{ marginBottom: 16 }} />
            <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
              Failed to load libraries
            </Text>
            <Text style={{ color: '#a1a1aa', marginBottom: 16 }}>{error.message}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#dc2626', borderRadius: 8 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '500' }}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Layout>
    );
  }

  // Empty
  if (!libraries || libraries.length === 0) {
    return (
      <Layout>
        <EmptyState onAddLibrary={handleAddLibrary} />
        <LibraryForm isOpen={isFormOpen} library={editingLibrary} onClose={handleCloseForm} onSuccess={handleFormSuccess} />
      </Layout>
    );
  }

  return (
    <Layout>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 32 }}>
          {/* Header */}
          <View
            style={{
              marginBottom: 32,
              flexDirection: width >= 640 ? 'row' : 'column',
              alignItems: width >= 640 ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <View>
              <Text style={{ fontSize: 30, fontWeight: '700', color: '#ffffff' }}>Libraries</Text>
              <Text style={{ color: '#a1a1aa', marginTop: 4 }}>
                Manage your media libraries and scan for new content
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => scanAllMutation.mutate()}
                disabled={scanAllMutation.isPending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#27272a',
                  borderRadius: 8,
                  opacity: scanAllMutation.isPending ? 0.5 : 1,
                }}
              >
                <Feather name="refresh-cw" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '500' }}>Scan All</Text>
              </Pressable>
              <Pressable
                onPress={handleAddLibrary}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#6366f1',
                  borderRadius: 8,
                }}
              >
                <Feather name="plus" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '500' }}>Add Library</Text>
              </Pressable>
            </View>
          </View>

          {/* Success message */}
          {scanAllMutation.isSuccess && (
            <View
              style={{
                marginBottom: 24,
                padding: 16,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Feather name="check" size={18} color="#34d399" />
              <Text style={{ color: '#6ee7b7' }}>Scan started for {scanAllMutation.data?.count} libraries</Text>
            </View>
          )}

          {/* Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {libraries.map((library: Library) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <View key={library.id} style={{ width: itemWidth } as any}>
                <LibraryCard library={library} onEdit={() => handleEditLibrary(library)} onRefresh={refetch} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <LibraryForm isOpen={isFormOpen} library={editingLibrary} onClose={handleCloseForm} onSuccess={handleFormSuccess} />
    </Layout>
  );
}
