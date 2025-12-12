/**
 * Trakt OAuth Callback Page
 *
 * Handles the OAuth callback from Trakt after user authorizes the app.
 */

import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useHandleOAuthCallback } from '@mediaserver/api-client';

export default function TraktCallback() {
  const { code, error: oauthError } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOAuthCallback = useHandleOAuthCallback();

  useEffect(() => {
    if (oauthError) {
      setStatus('error');
      setErrorMessage(`Authorization denied: ${oauthError}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No authorization code received');
      return;
    }

    // Exchange code for tokens
    const redirectUri = `${window.location.origin}/auth/trakt/callback`;
    
    handleOAuthCallback.mutate(
      { id: 'trakt', code, redirectUri },
      {
        onSuccess: (data: { success: boolean; error?: string | null }) => {
          if (data.success) {
            setStatus('success');
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth_callback', success: true }, window.location.origin);
            }
            // Close popup after a short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            setStatus('error');
            setErrorMessage(data.error || 'Failed to connect account');
          }
        },
        onError: (error: unknown) => {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Failed to connect account');
        },
      }
    );
  }, [code, oauthError]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#09090b',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <View
        style={{
          backgroundColor: '#18181b',
          borderRadius: 16,
          padding: 32,
          maxWidth: 400,
          width: '100%',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#27272a',
        }}
      >
        {status === 'processing' && (
          <>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#ed1c24',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 24 }}>📺</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
              Connecting to Trakt
            </Text>
            <Text style={{ color: '#a1a1aa', textAlign: 'center' }}>
              Please wait while we complete the connection...
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#22c55e',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 24, color: '#fff' }}>✓</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
              Connected!
            </Text>
            <Text style={{ color: '#a1a1aa', textAlign: 'center' }}>
              Your Trakt account has been connected successfully.
              This window will close automatically.
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#ef4444',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 24, color: '#fff' }}>✗</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
              Connection Failed
            </Text>
            <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>
              {errorMessage}
            </Text>
            <Text style={{ color: '#71717a', textAlign: 'center', fontSize: 13 }}>
              You can close this window and try again.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
