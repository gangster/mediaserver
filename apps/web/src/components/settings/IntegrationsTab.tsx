/**
 * IntegrationsTab - Server settings for metadata integrations
 */

import React, { useState, useCallback } from 'react';
import { View, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '@mediaserver/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  useIntegrations,
  useUpdateIntegration,
  useTestIntegrationConnection,
  useRatingSources,
  useUpdateRatingSources,
} from '@mediaserver/api-client';

interface Integration {
  id: string;
  name: string;
  description: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
  usesOAuth: boolean;
  supportsMovies: boolean;
  supportsShows: boolean;
  supportsAnime: boolean;
  ratingSources: string[];
  enabled: boolean;
  hasApiKey: boolean;
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: Integration | null;
}

function ConfigModal({ isOpen, onClose, integration }: ConfigModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  const updateMutation = useUpdateIntegration();
  const testMutation = useTestIntegrationConnection();

  React.useEffect(() => {
    if (integration) {
      setEnabled(integration.enabled);
      setApiKey(''); // Don't show existing key for security
    }
  }, [integration]);

  const handleSave = useCallback(async () => {
    if (!integration) return;

    await updateMutation.mutateAsync({
      id: integration.id,
      apiKey: apiKey || undefined,
      enabled,
    });

    onClose();
  }, [integration, apiKey, enabled, updateMutation, onClose]);

  const handleTest = useCallback(async () => {
    if (!integration) return;
    await testMutation.mutateAsync({ id: integration.id });
  }, [integration, testMutation]);

  if (!isOpen || !integration) return null;

  return (
    <View
      style={{
        position: 'fixed' as unknown as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
      } as React.ComponentProps<typeof View>['style']}
    >
      <View
        style={{
          backgroundColor: '#1a1a2e',
          borderRadius: 12,
          width: '90%',
          maxWidth: 500,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
            Configure {integration.name}
          </Text>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ padding: 16, gap: 16 }}>
          {/* Enabled toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, color: '#fff' }}>Enabled</Text>
            <Pressable
              onPress={() => setEnabled(!enabled)}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: enabled ? '#22c55e' : 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                padding: 2,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#fff',
                  alignSelf: enabled ? 'flex-end' : 'flex-start',
                }}
              />
            </Pressable>
          </View>

          {/* API Key */}
          {integration.requiresApiKey && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>API Key</Text>
                {integration.apiKeyUrl && (
                  <Pressable
                    onPress={() => {
                      // Would open URL in browser
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#3b82f6' }}>Get API Key →</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={integration.hasApiKey ? '••••••••••••••••' : 'Enter API key...'}
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 12,
                  color: '#fff',
                  fontSize: 14,
                }}
              />
            </View>
          )}

          {/* Test Connection */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleTest}
              disabled={testMutation.isPending}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                paddingVertical: 12,
                borderRadius: 8,
                opacity: testMutation.isPending ? 0.5 : 1,
              })}
            >
              {testMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="flash-outline" size={18} color="#fff" />
              )}
              <Text style={{ fontSize: 14, color: '#fff' }}>Test Connection</Text>
            </Pressable>
          </View>

          {/* Test result */}
          {testMutation.data && (
            <View
              style={{
                backgroundColor: testMutation.data.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                padding: 12,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons
                name={testMutation.data.success ? 'checkmark-circle' : 'alert-circle'}
                size={20}
                color={testMutation.data.success ? '#22c55e' : '#ef4444'}
              />
              <Text style={{ fontSize: 14, color: testMutation.data.success ? '#22c55e' : '#ef4444' }}>
                {testMutation.data.success ? 'Connection successful!' : testMutation.data.error}
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
            })}
          >
            <Text style={{ fontSize: 14, color: '#fff' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: pressed ? 'rgba(229,9,20,0.8)' : '#e50914',
              opacity: updateMutation.isPending ? 0.5 : 1,
            })}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function IntegrationCard({ integration, onConfigure }: { integration: Integration; onConfigure: () => void }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
              {integration.name}
            </Text>
            <View
              style={{
                backgroundColor: integration.enabled && integration.hasApiKey ? '#22c55e' : 'rgba(255,255,255,0.2)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '500' }}>
                {integration.enabled && integration.hasApiKey ? 'Active' : 'Disabled'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {integration.description}
          </Text>
        </View>
      </View>

      {/* Capabilities */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {integration.supportsMovies && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="film-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Movies</Text>
          </View>
        )}
        {integration.supportsShows && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="tv-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>TV Shows</Text>
          </View>
        )}
        {integration.supportsAnime && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Anime</Text>
          </View>
        )}
      </View>

      {/* Configure button */}
      <Pressable
        onPress={onConfigure}
        style={({ pressed }) => ({
          alignItems: 'center',
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
        })}
      >
        <Text style={{ fontSize: 14, color: '#fff' }}>Configure</Text>
      </Pressable>
    </View>
  );
}

export function IntegrationsTab() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const { data: integrations, isLoading } = useIntegrations();
  const { data: ratingSources } = useRatingSources();
  const updateRatingSources = useUpdateRatingSources();

  const handleConfigure = useCallback((integration: Integration) => {
    setSelectedIntegration(integration);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIntegration(null);
  }, []);

  if (isLoading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 24 }}>
        {/* Metadata Integrations Section */}
        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
              Metadata Integrations
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              Configure external services for metadata and ratings
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {integrations?.map((integration: Integration) => (
              <View key={integration.id} style={{ width: '100%', maxWidth: 350 }}>
                <IntegrationCard
                  integration={integration}
                  onConfigure={() => handleConfigure(integration)}
                />
              </View>
            ))}

            {(!integrations || integrations.length === 0) && (
              <View style={{ padding: 20, alignItems: 'center', width: '100%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
                  No integrations available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Rating Sources Section */}
        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
              Rating Sources
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              Select which rating sources to display on movie and show pages
            </Text>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 16,
              gap: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Primary Metadata Integration
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 14, color: '#fff' }}>
                  {ratingSources?.primaryProvider?.toUpperCase() ?? 'TMDB'}
                </Text>
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Enabled Rating Sources
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['imdb', 'rt_critics', 'rt_audience', 'metacritic', 'letterboxd', 'trakt', 'tmdb'].map(
                  (source) => {
                    const isEnabled = ratingSources?.enabledSources?.includes(source);
                    return (
                      <Pressable
                        key={source}
                        onPress={() => {
                          const current = ratingSources?.enabledSources ?? [];
                          const updated = isEnabled
                            ? current.filter((s: string) => s !== source)
                            : [...current, source];
                          updateRatingSources.mutate({ enabledSources: updated });
                        }}
                        style={{
                          backgroundColor: isEnabled ? '#e50914' : 'rgba(255,255,255,0.1)',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: '#fff' }}>
                          {source.replace('_', ' ').toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <ConfigModal
        isOpen={selectedIntegration !== null}
        onClose={handleCloseModal}
        integration={selectedIntegration}
      />
    </>
  );
}
