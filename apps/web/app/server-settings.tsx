/**
 * Server Settings Page
 *
 * Admin-only server configuration with tabs for Security, Providers, and General settings.
 * Design inspired by forreel's admin settings.
 */

import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Redirect } from 'expo-router';
import { Layout } from '../src/components/layout';
import { useAuth, useModalKeyboard } from '../src/hooks';
import {
  useIntegrations,
  useIntegration,
  useUpdateIntegration,
  useTestIntegrationConnection,
  useRatingSources,
  useUpdateRatingSources,
  usePrimaryProviders,
  useUpdatePrimaryProviders,
  useGetOAuthUrl,
  useOAuthStatus,
  useDisconnectOAuth,
} from '@mediaserver/api-client';

type SettingsTab = 'security' | 'providers' | 'general';

/** Rating source info */
const RATING_SOURCES = [
  { id: 'imdb', name: 'IMDb', icon: '⭐', color: '#f5c518' },
  { id: 'rt_critics', name: 'Rotten Tomatoes Critics', icon: '🍅', color: '#fa320a' },
  { id: 'rt_audience', name: 'Rotten Tomatoes Audience', icon: '🍿', color: '#fa320a' },
  { id: 'metacritic', name: 'Metacritic', icon: '🎯', color: '#ffcc34' },
  { id: 'letterboxd', name: 'Letterboxd', icon: '📝', color: '#ff8000' },
  { id: 'trakt', name: 'Trakt', icon: '📺', color: '#ed1c24' },
  { id: 'tmdb', name: 'TMDb', icon: '🎬', color: '#01d277' },
];

/** Provider card component */
function ProviderCard({
  provider,
  onConfigure,
}: {
  provider: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    hasApiKey: boolean;
    apiKeyUrl?: string;
    ratingSources: string[];
  };
  onConfigure: () => void;
}) {
  const statusColor = provider.enabled && provider.hasApiKey
    ? '#22c55e'
    : provider.enabled
      ? '#eab308'
      : '#71717a';

  const statusText = provider.enabled && provider.hasApiKey
    ? 'Active'
    : provider.enabled
      ? 'No API Key'
      : 'Disabled';

  return (
    <View
      style={{
        backgroundColor: 'rgba(24, 24, 27, 0.5)',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#3f3f46',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontWeight: '600', color: '#fff', fontSize: 16 }}>{provider.name}</Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 9999,
                backgroundColor: statusColor,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>{statusText}</Text>
            </View>
          </View>
          <Text style={{ color: '#a1a1aa', fontSize: 13 }}>{provider.description}</Text>
        </View>
        <Pressable
          onPress={onConfigure}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: '#4f46e5',
            borderRadius: 6,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>Configure</Text>
        </Pressable>
      </View>

      {/* Rating sources */}
      {provider.ratingSources && provider.ratingSources.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#71717a', fontSize: 13 }}>Ratings:</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {provider.ratingSources.map((source) => {
              const ratingInfo = RATING_SOURCES.find((s) => s.id === source);
              return (
                <Text key={source} style={{ fontSize: 16 }}>
                  {ratingInfo?.icon || '⭐'}
                </Text>
              );
            })}
          </View>
        </View>
      )}

      {/* API key prompt */}
      {!provider.hasApiKey && provider.apiKeyUrl && (
        <View
          style={{
            marginTop: 12,
            padding: 8,
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(234, 179, 8, 0.3)',
            borderRadius: 6,
          }}
        >
          <Pressable onPress={() => window.open(provider.apiKeyUrl, '_blank')}>
            <Text style={{ color: '#fbbf24', fontSize: 12 }}>Get API key →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Configure provider modal */
function ConfigureProviderModal({
  providerId,
  onClose,
  onSave,
}: {
  providerId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionTested, setConnectionTested] = useState<{ success: boolean; error?: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Fetch fresh data each time modal opens (hook configured to always refetch on mount)
  const { data: provider, isLoading } = useIntegration(providerId);
  const { data: oauthStatus, refetch: refetchOAuth } = useOAuthStatus(providerId, provider?.usesOAuth ?? false);
  const updateMutation = useUpdateIntegration();
  const testMutation = useTestIntegrationConnection();
  const getOAuthUrlMutation = useGetOAuthUrl();
  const disconnectOAuthMutation = useDisconnectOAuth();

  const isOAuthProvider = provider?.usesOAuth ?? false;
  
  // Current key value (works for both OAuth and regular providers)
  const currentKey = isOAuthProvider ? clientId : apiKey;
  const hasKey = !!currentKey;

  // Handle Escape key to close modal
  useModalKeyboard({ onEscape: onClose });

  // Populate form fields when provider data loads (only on initial load)
  useEffect(() => {
    if (provider && !initialized) {
      // Populate API key fields from saved config
      if (isOAuthProvider) {
        setClientId(provider.apiKey ?? '');
        setClientSecret((provider.config?.clientSecret as string) ?? '');
      } else {
        setApiKey(provider.apiKey ?? '');
      }
      // Set enabled based on server state
      const hasApiKey = !!provider.apiKey;
      setEnabled(hasApiKey && provider.enabled);
      setInitialized(true);
    }
  }, [provider, isOAuthProvider, initialized]);

  // When API key changes: clear test result and auto-disable if cleared
  useEffect(() => {
    // Skip on initial load
    if (!initialized) return;
    
    // Clear previous test result when key changes
    setConnectionTested(null);
    
    // Auto-disable if key is cleared
    if (!currentKey) {
      setEnabled(false);
    }
  }, [currentKey, initialized]);

  const handleTest = async () => {
    if (!currentKey) return; // Don't test without a key
    
    try {
      const result = await testMutation.mutateAsync({ 
        id: providerId,
        apiKey: currentKey,
      });
      
      setConnectionTested(result);
      
      // Auto-enable if connection test succeeds
      if (result.success) {
        setEnabled(true);
      }
    } catch (error) {
      setConnectionTested({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Test failed' 
      });
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    
    try {
      const config: Record<string, unknown> = {};
      
      if (isOAuthProvider) {
        // For OAuth providers like Trakt, store clientId/clientSecret in config
        if (clientId) config['clientId'] = clientId;
        if (clientSecret) config['clientSecret'] = clientSecret;
      }
      
      // Determine the API key to save
      const keyToSave = isOAuthProvider ? clientId : apiKey;
      
      // If there's an API key, verify it works before saving
      if (keyToSave) {
        const testResult = await testMutation.mutateAsync({
          id: providerId,
          apiKey: keyToSave,
        });
        
        if (!testResult.success) {
          setSaveError(testResult.error || 'Invalid API key - connection test failed');
          setIsSaving(false);
          return;
        }
        
        // Connection verified - use user's enabled choice, defaulting to true for new keys
        // If previously had no key (adding new), auto-enable
        // If updating existing key, respect the toggle state
        const wasConfigured = provider?.hasApiKey ?? false;
        const shouldEnable = wasConfigured ? enabled : true;
        
        await updateMutation.mutateAsync({
          id: providerId,
          apiKey: keyToSave,
          enabled: shouldEnable,
          config: Object.keys(config).length > 0 ? config : undefined,
        });
      } else {
        // No API key - clear it and disable
        await updateMutation.mutateAsync({
          id: providerId,
          apiKey: null,
          enabled: false,
          config: Object.keys(config).length > 0 ? config : undefined,
        });
      }
      
      onSave();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectOAuth = async () => {
    // Get the OAuth URL
    const redirectUri = `${window.location.origin}/auth/trakt/callback`;
    const result = await getOAuthUrlMutation.mutateAsync({ 
      id: providerId, 
      redirectUri 
    });
    
    if (result.url) {
      // Open in new window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        result.url,
        'oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Listen for callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'oauth_callback' && event.data?.success) {
          refetchOAuth();
          popup?.close();
        }
        window.removeEventListener('message', handleMessage);
      };
      window.addEventListener('message', handleMessage);
    }
  };

  const handleDisconnectOAuth = async () => {
    await disconnectOAuthMutation.mutateAsync({ id: providerId });
    refetchOAuth();
  };

  if (isLoading) {
    return (
      <View
        style={{
          position: 'fixed' as unknown as undefined,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        <View style={{ backgroundColor: '#18181b', borderRadius: 12, padding: 24, width: 400 }}>
          <View style={{ height: 32, backgroundColor: '#3f3f46', borderRadius: 6, marginBottom: 16 }} />
          <View style={{ height: 96, backgroundColor: '#3f3f46', borderRadius: 6 }} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'fixed' as unknown as undefined,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      {/* Backdrop - click to close */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute' as unknown as undefined,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }}
      />
      <View
        style={{
          backgroundColor: '#18181b',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 420,
          borderWidth: 1,
          borderColor: '#3f3f46',
          zIndex: 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>
            Configure {provider?.name}
          </Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: '#a1a1aa', fontSize: 24 }}>×</Text>
          </Pressable>
        </View>

        <View style={{ gap: 16 }}>
          {/* OAuth providers (Trakt) */}
          {isOAuthProvider ? (
            <>
              {/* Client ID */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#d4d4d8' }}>Client ID</Text>
                  {provider?.apiKeyUrl && (
                    <Pressable onPress={() => window.open(provider.apiKeyUrl, '_blank')}>
                      <Text style={{ color: '#818cf8', fontSize: 12 }}>Create app →</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  value={clientId}
                  onChangeText={setClientId}
                  placeholder={provider?.hasApiKey ? '••••••••' : 'Enter client ID'}
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: '#27272a',
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </View>

              {/* Client Secret */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#d4d4d8', marginBottom: 6 }}>Client Secret</Text>
                <TextInput
                  value={clientSecret}
                  onChangeText={setClientSecret}
                  secureTextEntry
                  placeholder="Enter client secret"
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: '#27272a',
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </View>

              {/* OAuth connection status */}
              <View
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(39, 39, 42, 0.5)',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#3f3f46',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '500', fontSize: 13 }}>Account Connection</Text>
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                      {oauthStatus?.connected ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                  {oauthStatus?.connected ? (
                    <Pressable
                      onPress={handleDisconnectOAuth}
                      disabled={disconnectOAuthMutation.isPending}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: '#ef4444',
                        borderRadius: 6,
                        opacity: disconnectOAuthMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Disconnect</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleConnectOAuth}
                      disabled={getOAuthUrlMutation.isPending || !clientId}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: '#ed1c24',
                        borderRadius: 6,
                        opacity: (getOAuthUrlMutation.isPending || !clientId) ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
                        {getOAuthUrlMutation.isPending ? 'Connecting...' : 'Connect with Trakt'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {getOAuthUrlMutation.data?.error && (
                  <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>
                    {getOAuthUrlMutation.data.error}
                  </Text>
                )}
              </View>
            </>
          ) : (
            /* API Key providers */
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#d4d4d8' }}>API Key</Text>
                {provider?.apiKeyUrl && (
                  <Pressable onPress={() => window.open(provider.apiKeyUrl, '_blank')}>
                    <Text style={{ color: '#818cf8', fontSize: 12 }}>Get API key →</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  secureTextEntry={!showApiKey}
                  placeholder="Enter API key"
                  placeholderTextColor="#71717a"
                  style={{
                    flex: 1,
                    backgroundColor: '#27272a',
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
                <Pressable
                  onPress={() => setShowApiKey(!showApiKey)}
                  style={{ marginLeft: -36, paddingHorizontal: 8 }}
                >
                  <Text style={{ color: '#71717a' }}>{showApiKey ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Enabled toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#d4d4d8' }}>Enabled</Text>
              {!hasKey && (
                <Text style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                  Requires API key
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => hasKey && setEnabled(!enabled)}
              disabled={!hasKey}
              style={{
                width: 48,
                height: 24,
                borderRadius: 12,
                backgroundColor: (hasKey && enabled) ? '#4f46e5' : '#3f3f46',
                justifyContent: 'center',
                padding: 2,
                opacity: hasKey ? 1 : 0.5,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  alignSelf: (hasKey && enabled) ? 'flex-end' : 'flex-start',
                }}
              />
            </Pressable>
          </View>

          {/* Test connection (optional - we auto-test on save) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={handleTest}
                disabled={!hasKey || testMutation.isPending || isSaving}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#3f3f46',
                  borderRadius: 8,
                  opacity: (!hasKey || testMutation.isPending || isSaving) ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13 }}>
                  {testMutation.isPending ? 'Testing...' : 'Test Connection'}
                </Text>
              </Pressable>
              {hasKey && (
                <Text style={{ color: '#71717a', fontSize: 12 }}>
                  Auto-verified on save
                </Text>
              )}
            </View>
            {connectionTested && !isSaving && (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: connectionTested.success ? '#22c55e' : '#ef4444',
                }}
              >
                {connectionTested.success ? '✓ Connection successful' : `✗ ${connectionTested.error}`}
              </Text>
            )}
          </View>
        </View>

        {/* Error message */}
        {saveError && (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#ef4444', fontSize: 13 }}>
              ✗ {saveError}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Pressable 
            onPress={onClose} 
            disabled={isSaving}
            style={{ paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Text style={{ color: '#a1a1aa' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: '#4f46e5',
              borderRadius: 8,
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '500' }}>
              {isSaving ? 'Verifying...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Rating source selector */
function RatingSourceSelector({
  enabledSources,
  onChange,
}: {
  enabledSources: string[];
  onChange: (sources: string[]) => void;
}) {
  const toggleSource = (sourceId: string) => {
    if (enabledSources.includes(sourceId)) {
      onChange(enabledSources.filter((s) => s !== sourceId));
    } else {
      onChange([...enabledSources, sourceId]);
    }
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {RATING_SOURCES.map((source) => {
        const isEnabled = enabledSources.includes(source.id);
        return (
          <Pressable
            key={source.id}
            onPress={() => toggleSource(source.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: isEnabled ? 'rgba(79, 70, 229, 0.2)' : 'rgba(24, 24, 27, 0.5)',
              borderWidth: 1,
              borderColor: isEnabled ? 'rgba(99, 102, 241, 0.5)' : '#3f3f46',
              minWidth: 150,
            }}
          >
            <Text style={{ fontSize: 16 }}>{source.icon}</Text>
            <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{source.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Primary provider dropdown component */
function ProviderDropdown({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = () => setIsOpen(false);
    // Use a small delay to avoid immediately closing when opening
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <View style={{ flex: 1, minWidth: 200 }}>
      <Text style={{ color: '#fff', fontWeight: '500', marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: '#71717a', fontSize: 12, marginBottom: 8 }}>{description}</Text>
      <View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setIsOpen(!isOpen);
          }}
          style={{
            backgroundColor: '#27272a',
            borderWidth: 1,
            borderColor: isOpen ? '#4f46e5' : '#3f3f46',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: selectedOption ? '#fff' : '#71717a', fontSize: 14 }}>
            {selectedOption?.name || 'Select provider...'}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {isOpen && (
          <View
            style={{
              marginTop: 4,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              overflow: 'hidden',
            } as const}
          >
            {options.length > 0 ? (
              options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleSelect(option.id);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: pressed 
                      ? 'rgba(79, 70, 229, 0.3)' 
                      : option.id === value 
                        ? 'rgba(79, 70, 229, 0.2)' 
                        : 'transparent',
                  })}
                >
                  <Text style={{ color: option.id === value ? '#818cf8' : '#fff', fontSize: 14 }}>
                    {option.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: '#71717a', fontSize: 13 }}>
                  No providers available. Configure and enable a metadata provider first.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** Providers tab content */
function ProvidersTab() {
  const [configureProvider, setConfigureProvider] = useState<string | null>(null);

  const { data: integrations, isLoading, refetch } = useIntegrations();
  const { data: ratingSources, refetch: refetchRatingSources } = useRatingSources();
  const { data: primaryProviders, refetch: refetchPrimaryProviders } = usePrimaryProviders();
  const updateRatingSources = useUpdateRatingSources();
  const updatePrimaryProviders = useUpdatePrimaryProviders();

  const handleSaveRatingSources = async (sources: string[]) => {
    await updateRatingSources.mutateAsync({ enabledSources: sources });
    refetchRatingSources();
  };

  // Filter integrations for movie and TV metadata providers
  // Only include providers that: provide metadata, support the content type, are enabled, and have an API key
  type IntegrationWithMetadata = {
    id: string;
    name: string;
    providesMetadata?: boolean;
    supportsMovies?: boolean;
    supportsShows?: boolean;
    enabled: boolean;
    hasApiKey: boolean;
  };

  const movieProviders = (integrations ?? [])
    .filter((i: IntegrationWithMetadata) => 
      i.providesMetadata && i.supportsMovies && i.enabled && i.hasApiKey
    )
    .map((i: IntegrationWithMetadata) => ({ id: i.id, name: i.name }));

  const tvProviders = (integrations ?? [])
    .filter((i: IntegrationWithMetadata) => 
      i.providesMetadata && i.supportsShows && i.enabled && i.hasApiKey
    )
    .map((i: IntegrationWithMetadata) => ({ id: i.id, name: i.name }));

  const handleMovieProviderChange = async (providerId: string) => {
    await updatePrimaryProviders.mutateAsync({ movieProvider: providerId });
    refetchPrimaryProviders();
  };

  const handleTvProviderChange = async (providerId: string) => {
    await updatePrimaryProviders.mutateAsync({ tvProvider: providerId });
    refetchPrimaryProviders();
  };

  return (
    <View style={{ gap: 24 }}>
      {/* Providers section */}
      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 24 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>Metadata Providers</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>
            Configure external services for metadata and ratings
          </Text>
        </View>

        {isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  height: 128,
                  backgroundColor: 'rgba(24, 24, 27, 0.5)',
                  borderRadius: 8,
                  flex: 1,
                  minWidth: 280,
                }}
              />
            ))}
          </View>
        ) : integrations && integrations.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {integrations.map((provider: {
              id: string;
              name: string;
              description: string;
              enabled: boolean;
              hasApiKey: boolean;
              apiKeyUrl?: string;
              ratingSources: string[];
            }) => (
              <View key={provider.id} style={{ flex: 1, minWidth: 280 }}>
                <ProviderCard
                  provider={provider}
                  onConfigure={() => setConfigureProvider(provider.id)}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: '#71717a', textAlign: 'center', paddingVertical: 24 }}>
            No integrations available. Check server logs.
          </Text>
        )}
      </View>

      {/* Primary Metadata Providers section */}
      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 24 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>Primary Metadata Providers</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>
            Select which providers to use for fetching movie and TV show metadata
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
          <ProviderDropdown
            label="Movie Provider"
            description="Used for movie search, details, and artwork"
            value={primaryProviders?.movieProvider ?? 'tmdb'}
            options={movieProviders}
            onChange={handleMovieProviderChange}
          />
          <ProviderDropdown
            label="TV Show Provider"
            description="Used for TV show search, details, and artwork"
            value={primaryProviders?.tvProvider ?? 'tmdb'}
            options={tvProviders}
            onChange={handleTvProviderChange}
          />
        </View>

        {(movieProviders.length === 0 || tvProviders.length === 0) && (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' }}>
            <Text style={{ color: '#fbbf24', fontSize: 13 }}>
              ⚠️ {movieProviders.length === 0 && tvProviders.length === 0 
                ? 'No providers configured. Enable and configure a metadata provider above to select it here.'
                : movieProviders.length === 0 
                  ? 'No movie providers available. Configure TMDB or another provider that supports movies.'
                  : 'No TV providers available. Configure TMDB, TVDb, or another provider that supports TV shows.'}
            </Text>
          </View>
        )}
      </View>

      {/* Rating Sources section */}
      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 24 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>Rating Sources</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>
            Select which rating sources to display on movie and show pages
          </Text>
        </View>

        {/* Enabled rating sources */}
        <View>
          <Text style={{ color: '#fff', fontWeight: '500', marginBottom: 12 }}>Enabled Rating Sources</Text>
          {ratingSources && (
            <RatingSourceSelector
              enabledSources={ratingSources.enabledSources || []}
              onChange={handleSaveRatingSources}
            />
          )}
        </View>
      </View>

      {/* How it works */}
      <View
        style={{
          padding: 16,
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#3f3f46',
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#d4d4d8', marginBottom: 8 }}>
          How providers work
        </Text>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, color: '#71717a' }}>
            <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>TMDb</Text> - Primary metadata source (movies, shows, images, credits)
          </Text>
          <Text style={{ fontSize: 13, color: '#71717a' }}>
            <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>MDbList</Text> - Aggregated ratings from IMDb, Rotten Tomatoes, Metacritic, Letterboxd
          </Text>
          <Text style={{ fontSize: 13, color: '#71717a' }}>
            <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>TVDb</Text> - Alternative TV/anime database with detailed episode info
          </Text>
          <Text style={{ fontSize: 13, color: '#71717a' }}>
            <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>Trakt</Text> - Watch history sync and community ratings
          </Text>
        </View>
      </View>

      {/* Configure modal */}
      {configureProvider && (
        <ConfigureProviderModal
          providerId={configureProvider}
          onClose={() => setConfigureProvider(null)}
          onSave={() => refetch()}
        />
      )}
    </View>
  );
}

export default function ServerSettingsPage() {
  const { isAdmin, isInitialized } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');

  if (!isInitialized) {
    return (
      <Layout>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#a1a1aa' }}>Loading...</Text>
        </View>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'security', label: 'Security' },
    { id: 'providers', label: 'Providers' },
    { id: 'general', label: 'General' },
  ];

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>Server Settings</Text>
          <Text style={{ color: '#71717a', marginTop: 4 }}>Configure global server settings</Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 24, gap: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' }}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.id ? '#6366f1' : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === tab.id ? '#fff' : '#71717a',
                  fontWeight: activeTab === tab.id ? '500' : '400',
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={{ padding: 24, maxWidth: 900 }}>
          {activeTab === 'security' && (
            <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
                Session Management
              </Text>
              <Text style={{ color: '#71717a', textAlign: 'center', paddingVertical: 32 }}>
                Session settings will be available in a future update.
              </Text>
            </View>
          )}

          {activeTab === 'providers' && <ProvidersTab />}

          {activeTab === 'general' && (
            <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
                General Settings
              </Text>
              <Text style={{ color: '#71717a', textAlign: 'center', paddingVertical: 32 }}>
                Additional settings will be available in a future update.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}
