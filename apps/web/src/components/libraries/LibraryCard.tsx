/**
 * Library Card Component
 *
 * Displays a single library with stats, status, and actions.
 * Matches forreel's LibraryCard design.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { trpc } from '@mediaserver/api-client';
import { useModalKeyboard } from '../../hooks';
import type { Library } from '../../../app/libraries';

interface LibraryCardProps {
  library: Library;
  onEdit: () => void;
  onRefresh: () => void;
}

export function LibraryCard({ library, onEdit, onRefresh }: LibraryCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [scanResult, setScanResult] = useState<{
    added: number;
    updated: number;
    errors: number;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Parse paths - may be JSON string or already an array
  const paths: string[] = Array.isArray(library.paths)
    ? library.paths
    : typeof library.paths === 'string'
      ? JSON.parse(library.paths)
      : [];

  // Query for scan status - polling enabled when isPolling is true
  const { data: scanStatus } = trpc.libraries.scanStatus.useQuery(
    { id: library.id },
    {
      refetchInterval: isPolling ? 1000 : false,
      enabled: isPolling,
    }
  );

  const scanMutation = trpc.libraries.scan.useMutation({
    onSuccess: () => {
      // Start polling for status
      setIsPolling(true);
    },
  });

  const deleteMutation = trpc.libraries.delete.useMutation({
    onSuccess: () => {
      onRefresh();
    },
  });

  // Handle Escape key to close delete confirmation
  useModalKeyboard({
    onEscape: () => setShowDeleteConfirm(false),
    isOpen: showDeleteConfirm,
  });

  // Handle scan status updates
  useEffect(() => {
    if (!scanStatus || !isPolling) return;

    if (scanStatus.status === 'completed') {
      setIsPolling(false);
      // Parse result if available
      try {
        const result = scanStatus.progressMessage;
        const match = result?.match(/Added (\d+), updated (\d+)/);
        if (match) {
          setScanResult({
            added: parseInt(match[1], 10),
            updated: parseInt(match[2], 10),
            errors: 0,
          });
        }
      } catch {
        // Ignore parse errors
      }
      onRefresh();
      setTimeout(() => setScanResult(null), 5000);
    } else if (scanStatus.status === 'failed') {
      setIsPolling(false);
      setScanResult({ added: 0, updated: 0, errors: 1 });
      setTimeout(() => setScanResult(null), 5000);
    }
  }, [scanStatus, isPolling, onRefresh]);

  const handleScan = useCallback(() => {
    setScanResult(null);
    scanMutation.mutate({ id: library.id });
  }, [library.id, scanMutation]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate({ id: library.id });
    setShowDeleteConfirm(false);
  }, [library.id, deleteMutation]);

  const formatLastScanned = (dateStr: string | null) => {
    if (!dateStr) return 'Never scanned';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isScanning = scanMutation.isPending || (isPolling && scanStatus?.status === 'running');
  const isPending = isPolling && scanStatus?.status === 'pending';
  const scanProgress = scanStatus?.progress ?? 0;
  const scanMessage = scanStatus?.progressMessage;
  const isMovie = library.type === 'movie';

  return (
    <>
      <Pressable
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={{
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isHovered ? '#3f3f46' : '#27272a',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Type icon */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isMovie ? 'rgba(99, 102, 241, 0.2)' : 'rgba(147, 51, 234, 0.2)',
                }}
              >
                {isMovie ? (
                  <MaterialCommunityIcons name="movie-open" size={20} color="#818cf8" />
                ) : (
                  <Ionicons name="tv" size={20} color="#a855f7" />
                )}
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>{library.name}</Text>
                <Text style={{ fontSize: 14, color: '#71717a' }}>
                  {library.itemCount > 0
                    ? `${library.itemCount} ${isMovie ? (library.itemCount === 1 ? 'movie' : 'movies') : library.itemCount === 1 ? 'show' : 'shows'}`
                    : 'No items yet'}
                </Text>
              </View>
            </View>

            {/* Menu button */}
            <View style={{ position: 'relative' }}>
              <Pressable
                onPress={() => setShowMenu(!showMenu)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  opacity: isHovered || showMenu ? 1 : 0,
                }}
              >
                <Feather name="more-vertical" size={20} color="#a1a1aa" />
              </Pressable>

              {showMenu && (
                <>
                  <Pressable
                    onPress={() => setShowMenu(false)}
                    style={{ position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
                  />
                  <View
                    style={{
                      position: 'absolute' as const,
                      right: 0,
                      top: 40,
                      width: 180,
                      backgroundColor: '#27272a',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#3f3f46',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => { setShowMenu(false); onEdit(); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <Feather name="edit-2" size={16} color="#d4d4d8" />
                      <Text style={{ color: '#d4d4d8', fontSize: 14 }}>Edit Library</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <Feather name="trash-2" size={16} color="#f87171" />
                      <Text style={{ color: '#f87171', fontSize: 14 }}>Delete Library</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Paths */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          {paths.map((path, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Feather name="folder" size={14} color="#52525b" />
              <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }} numberOfLines={1}>
                {path}
              </Text>
            </View>
          ))}
        </View>

        {/* Scan progress */}
        {(isScanning || isPending) && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              borderTopWidth: 1,
              borderTopColor: 'rgba(251, 191, 36, 0.2)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="refresh-cw" size={14} color="#fbbf24" />
              <Text style={{ color: '#fcd34d', fontSize: 14, flex: 1 }} numberOfLines={1}>
                {isPending ? 'Preparing scan...' : scanMessage || 'Scanning...'}
              </Text>
              <Text style={{ color: '#fbbf24', fontSize: 12 }}>{Math.round(scanProgress)}%</Text>
            </View>
            {/* Progress bar */}
            <View style={{ height: 4, backgroundColor: 'rgba(251, 191, 36, 0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${scanProgress}%`,
                  backgroundColor: '#fbbf24',
                  borderRadius: 2,
                }}
              />
            </View>
          </View>
        )}

        {/* Scan result */}
        {scanResult && !isScanning && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: scanResult.errors > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              borderTopWidth: 1,
              borderTopColor: scanResult.errors > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Feather
              name={scanResult.errors > 0 ? 'alert-circle' : 'check'}
              size={16}
              color={scanResult.errors > 0 ? '#f87171' : '#34d399'}
            />
            <Text style={{ color: scanResult.errors > 0 ? '#fca5a5' : '#6ee7b7', fontSize: 14 }}>
              {scanResult.errors > 0
                ? 'Scan completed with errors'
                : scanResult.added > 0 || scanResult.updated > 0
                  ? `Found ${scanResult.added} new, ${scanResult.updated} updated`
                  : 'No new items found'}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: 'rgba(39, 39, 42, 0.3)',
            borderTopWidth: 1,
            borderTopColor: '#27272a',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="clock" size={14} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 14 }}>{formatLastScanned(library.lastScannedAt)}</Text>
          </View>

          <Pressable
            onPress={handleScan}
            disabled={isScanning || isPending}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: '#3f3f46',
              borderRadius: 8,
              opacity: isScanning || isPending ? 0.5 : 1,
            }}
          >
            <Feather name="refresh-cw" size={14} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Scan</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <View
          style={{
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <Pressable
            onPress={() => setShowDeleteConfirm(false)}
            style={{
              position: 'absolute' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          />
          <View
            style={{
              backgroundColor: '#18181b',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#27272a',
              padding: 24,
              maxWidth: 400,
              width: '100%',
              zIndex: 51,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="alert-triangle" size={24} color="#f87171" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>Delete Library</Text>
                <Text style={{ fontSize: 14, color: '#a1a1aa' }}>This action cannot be undone</Text>
              </View>
            </View>
            <Text style={{ color: '#d4d4d8', marginBottom: 20, lineHeight: 22 }}>
              Are you sure you want to delete <Text style={{ fontWeight: '600', color: '#ffffff' }}>{library.name}</Text>?
              This will remove the library from Mediaserver, but your media files will not be deleted.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Pressable onPress={() => setShowDeleteConfirm(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#dc2626',
                  borderRadius: 8,
                  opacity: deleteMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
