/**
 * MetadataSourceSelector - Allows users to switch between different metadata providers
 *
 * Shows which metadata provider is currently active and lets users
 * toggle between available providers with instant UI updates.
 */

import { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvailableProviders, useProviderMetadata, type MetadataProvider } from '@mediaserver/api-client';

/** Provider display info */
const PROVIDER_INFO: Record<MetadataProvider, { name: string; color: string; icon: string }> = {
  tmdb: { name: 'TMDb', color: '#01d277', icon: '🎬' },
  tvdb: { name: 'TVDb', color: '#6cd491', icon: '📺' },
  anidb: { name: 'AniDB', color: '#2e51a2', icon: '🎌' },
  anilist: { name: 'AniList', color: '#02a9ff', icon: '📘' },
  mal: { name: 'MyAnimeList', color: '#2e51a2', icon: '🗾' },
  omdb: { name: 'OMDb', color: '#f5c518', icon: '🎥' },
  trakt: { name: 'Trakt', color: '#ed1c24', icon: '📊' },
};

interface MetadataSourceSelectorProps {
  /** Media type */
  type: 'movie' | 'show';
  /** Media item ID */
  itemId: string;
  /** Current/default provider */
  currentProvider?: MetadataProvider;
  /** Called when metadata changes with the new provider's data */
  onMetadataChange?: (metadata: ProviderMetadataResult | null, provider: MetadataProvider) => void;
  /** Called when provider selection changes */
  onProviderChange?: (provider: MetadataProvider) => void;
  /** Whether to show in compact mode (inline) vs full mode (section) */
  compact?: boolean;
}

/** Production company type */
export interface ProductionCompany {
  id: number;
  name: string;
  logoPath?: string | null;
  originCountry?: string;
}

/** Shape of provider metadata result */
export interface ProviderMetadataResult {
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  tagline?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  voteAverage?: number | null;
  voteCount?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  genres?: string[];
  status?: string | null;
  productionCompanies?: ProductionCompany[];
}

export function MetadataSourceSelector({
  type,
  itemId,
  currentProvider = 'tmdb',
  onMetadataChange,
  onProviderChange,
  compact = false,
}: MetadataSourceSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<MetadataProvider>(currentProvider);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch available providers
  const { data: availableProviders, isLoading: providersLoading } = useAvailableProviders(
    type,
    itemId,
    !!itemId
  );

  // Fetch metadata from selected provider
  const { data: providerMetadata, isLoading: metadataLoading } = useProviderMetadata(
    type,
    itemId,
    selectedProvider,
    !!itemId && !!selectedProvider
  );

  // Update parent when metadata loads
  useEffect(() => {
    if (providerMetadata && onMetadataChange) {
      onMetadataChange(providerMetadata as ProviderMetadataResult, selectedProvider);
    }
  }, [providerMetadata, selectedProvider, onMetadataChange]);

  // Handle provider change
  const handleProviderSelect = (provider: MetadataProvider) => {
    setSelectedProvider(provider);
    setIsDropdownOpen(false);
    if (onProviderChange) {
      onProviderChange(provider);
    }
  };

  // No providers available - don't show anything
  if (!providersLoading && (!availableProviders || availableProviders.length === 0)) {
    return null;
  }

  const selectedInfo = PROVIDER_INFO[selectedProvider];

  // Only one provider - show as informational badge (non-interactive)
  if (availableProviders && availableProviders.length === 1) {
    const provider = availableProviders[0]!.provider as MetadataProvider;
    const info = PROVIDER_INFO[provider];
    
    if (compact) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: 'rgba(39, 39, 42, 0.8)',
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 12, color: '#71717a' }}>Source:</Text>
          <Text style={{ fontSize: 12, color: info?.color ?? '#a1a1aa', fontWeight: '500' }}>
            {info?.name ?? provider}
          </Text>
        </View>
      );
    }

    // Full mode - single provider
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="information-circle-outline" size={18} color="#71717a" />
          <Text style={{ fontSize: 16, color: '#e4e4e7', fontWeight: '600' }}>
            Metadata Source
          </Text>
        </View>
        
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: 'rgba(39, 39, 42, 0.6)',
            borderRadius: 10,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ fontSize: 18 }}>{info?.icon ?? '📄'}</Text>
          <Text style={{ fontSize: 14, color: '#e4e4e7', fontWeight: '600' }}>
            {info?.name ?? provider}
          </Text>
        </View>
        
        <Text style={{ fontSize: 13, color: '#52525b' }}>
          Additional metadata sources can be configured in Server Settings → Integrations.
        </Text>
      </View>
    );
  }

  // Compact inline mode - shows as a subtle dropdown
  if (compact) {
    return (
      <View style={{ position: 'relative', zIndex: 100 }}>
        <Pressable
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: 'rgba(39, 39, 42, 0.9)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDropdownOpen ? '#10b981' : '#3f3f46',
          }}
        >
          {metadataLoading ? (
            <ActivityIndicator size="small" color="#a1a1aa" />
          ) : (
            <>
              <Ionicons name="swap-horizontal" size={14} color="#71717a" />
              <Text style={{ fontSize: 13, color: '#a1a1aa' }}>Source:</Text>
              <Text style={{ fontSize: 13, color: selectedInfo?.color ?? '#ffffff', fontWeight: '600' }}>
                {selectedInfo?.name ?? selectedProvider}
              </Text>
              <Ionicons 
                name={isDropdownOpen ? "chevron-up" : "chevron-down"} 
                size={14} 
                color="#71717a" 
              />
            </>
          )}
        </Pressable>

        {/* Dropdown */}
        {isDropdownOpen && (
          <View
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              backgroundColor: '#1f1f23',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#3f3f46',
              minWidth: 200,
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            } as const}
          >
            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#3f3f46' }}>
              <Text style={{ fontSize: 12, color: '#71717a', fontWeight: '500' }}>
                SWITCH METADATA SOURCE
              </Text>
            </View>
            {availableProviders?.map((p: { provider: string; title: string; fetchedAt: string }) => {
              const provider = p.provider as MetadataProvider;
              const info = PROVIDER_INFO[provider];
              const isSelected = provider === selectedProvider;
              return (
                <Pressable
                  key={provider}
                  onPress={() => handleProviderSelect(provider)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{info?.icon ?? '📄'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected ? '#10b981' : '#e4e4e7',
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {info?.name ?? provider}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                      {p.title}
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Backdrop to close dropdown */}
        {isDropdownOpen && (
          <Pressable
            onPress={() => setIsDropdownOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: -1,
            } as const}
          />
        )}
      </View>
    );
  }

  // Full section mode - shows as a labeled section with button group
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="swap-horizontal" size={18} color="#71717a" />
        <Text style={{ fontSize: 16, color: '#e4e4e7', fontWeight: '600' }}>
          Metadata Source
        </Text>
        {metadataLoading && <ActivityIndicator size="small" color="#10b981" />}
      </View>
      
      <Text style={{ fontSize: 13, color: '#71717a', marginBottom: 4 }}>
        Switch between different metadata providers to see alternate titles, descriptions, and details.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {providersLoading ? (
          <ActivityIndicator size="small" color="#a1a1aa" />
        ) : (
          availableProviders?.map((p: { provider: string; title: string; fetchedAt: string }) => {
            const provider = p.provider as MetadataProvider;
            const info = PROVIDER_INFO[provider];
            const isSelected = provider === selectedProvider;
            return (
              <Pressable
                key={provider}
                onPress={() => handleProviderSelect(provider)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(39, 39, 42, 0.6)',
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: isSelected ? '#10b981' : 'transparent',
                }}
              >
                <Text style={{ fontSize: 18 }}>{info?.icon ?? '📄'}</Text>
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      color: isSelected ? '#10b981' : '#e4e4e7',
                      fontWeight: '600',
                    }}
                  >
                    {info?.name ?? provider}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}
