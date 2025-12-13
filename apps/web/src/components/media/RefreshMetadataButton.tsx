/**
 * RefreshMetadataButton component
 *
 * A reusable button for refreshing metadata that handles:
 * - Job queue submission
 * - Job status polling
 * - Visual state feedback (idle, queuing, processing, success, error)
 * - Cache invalidation on completion
 *
 * Used on movie detail, show detail, and episode detail pages.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc, useRefreshMetadata, useJob } from '@mediaserver/api-client';

type RefreshStatus = 'idle' | 'queuing' | 'processing' | 'success' | 'error';

interface RefreshMetadataButtonProps {
  /** Type of media to refresh */
  type: 'movie' | 'tvshow';
  /** ID of the media item */
  itemId: string;
  /** Callback when refresh completes successfully */
  onSuccess?: () => void;
  /** Callback when refresh fails */
  onError?: (error: string) => void;
  /** Optional custom label */
  label?: string;
  /** Size variant */
  size?: 'default' | 'compact';
}

export function RefreshMetadataButton({
  type,
  itemId,
  onSuccess,
  onError,
  label = 'Refresh Metadata',
  size = 'default',
}: RefreshMetadataButtonProps) {
  const [status, setStatus] = useState<RefreshStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const refreshMetadata = useRefreshMetadata();
  const { data: jobData } = useJob(jobId ?? '', !!jobId);

  // Watch for job completion
  useEffect(() => {
    if (!jobData || status !== 'processing') return;

    if (jobData.status === 'completed') {
      setStatus('success');
      setJobId(null);

      // Invalidate relevant cache based on type
      if (type === 'movie') {
        utils.movies.get.invalidate({ id: itemId });
        utils.movies.getFileStats.invalidate({ id: itemId });
        utils.movies.getCredits.invalidate({ id: itemId });
        utils.metadata.getAvailableProviders.invalidate({ type: 'movie', itemId });
        utils.metadata.getProviderMetadata.invalidate({ type: 'movie', itemId });
      } else if (type === 'tvshow') {
        utils.shows.get.invalidate({ id: itemId });
        utils.shows.getCredits.invalidate({ id: itemId });
        // Also invalidate all seasons/episodes for this show
        utils.shows.getSeason.invalidate();
        utils.shows.getEpisode.invalidate();
        utils.metadata.getAvailableProviders.invalidate({ type: 'show', itemId });
        utils.metadata.getProviderMetadata.invalidate({ type: 'show', itemId });
      }

      onSuccess?.();

      // Reset to idle after showing success
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 3000);
    } else if (jobData.status === 'failed') {
      setStatus('error');
      const error = jobData.error ?? 'Failed to refresh metadata';
      setErrorMessage(error);
      setJobId(null);

      onError?.(error);

      // Reset to idle after showing error
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }, [jobData, status, itemId, type, utils, onSuccess, onError]);

  const handlePress = useCallback(async () => {
    if (status !== 'idle') return;

    setStatus('queuing');
    setErrorMessage(null);

    try {
      const result = await refreshMetadata.mutateAsync({ type, itemId });
      if (result.queued && result.jobId) {
        setJobId(result.jobId);
        setStatus('processing');
      }
    } catch (e) {
      setStatus('error');
      const error = e instanceof Error ? e.message : 'Failed to queue job';
      setErrorMessage(error);
      onError?.(error);

      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }, [status, type, itemId, refreshMetadata, onError]);

  // Determine button appearance based on status
  const isDisabled = status !== 'idle';
  const backgroundColor =
    status === 'success' ? '#166534' :
    status === 'error' ? '#991b1b' :
    '#27272a';
  const opacity = status === 'queuing' || status === 'processing' ? 0.7 : 1;

  // Determine icon
  const renderIcon = () => {
    const iconSize = size === 'compact' ? 16 : 20;

    if (status === 'queuing' || status === 'processing') {
      return <ActivityIndicator size="small" color="#ffffff" />;
    }
    if (status === 'success') {
      return <Ionicons name="checkmark-circle" size={iconSize} color="#22c55e" />;
    }
    if (status === 'error') {
      return <Ionicons name="alert-circle" size={iconSize} color="#ef4444" />;
    }
    return <Ionicons name="refresh" size={iconSize} color="#ffffff" />;
  };

  // Determine label text
  const labelText =
    status === 'queuing' ? 'Queuing...' :
    status === 'processing' ? 'Refreshing...' :
    status === 'success' ? 'Updated!' :
    status === 'error' ? 'Failed' :
    label;

  const paddingHorizontal = size === 'compact' ? 16 : 24;
  const paddingVertical = size === 'compact' ? 10 : 16;
  const fontSize = size === 'compact' ? 14 : 16;

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal,
          paddingVertical,
          backgroundColor,
          borderRadius: 8,
          opacity,
        }}
      >
        {renderIcon()}
        <Text style={{ fontSize, fontWeight: '600', color: '#ffffff' }}>
          {labelText}
        </Text>
      </Pressable>

      {/* Error message tooltip */}
      {errorMessage && status === 'error' && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={14} color="#fca5a5" />
          <Text style={styles.errorText} numberOfLines={2}>
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(185, 28, 28, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.4)',
    borderRadius: 6,
    maxWidth: 300,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#fca5a5',
  },
});

export default RefreshMetadataButton;

