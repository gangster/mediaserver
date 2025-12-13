/**
 * Web App Root Layout
 *
 * Sets up providers and navigation for the web application.
 */

import { useEffect, useMemo } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApiProvider, useSetupStatus } from '@mediaserver/api-client';
import { useAuth } from '../src/hooks/useAuth';
import { getAccessToken, handleAuthError } from '../src/stores/auth';
import { GluestackUIProvider } from '../src/components/ui/gluestack-ui-provider';
import { getApiBaseUrl } from '../src/lib/config';

import '../global.css';

/**
 * Auth guard component that redirects based on auth state and setup status
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for both auth and setup status to be ready
    if (setupLoading || !isInitialized) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'setup';
    const isLoginPage = pathname === '/login' || pathname === '/auth/login';
    const isSetupPage = pathname.startsWith('/setup');

    // If setup is not complete, redirect to setup (unless already there)
    if (setupStatus && !setupStatus.isComplete && !isSetupPage) {
      router.replace('/setup');
      return;
    }

    // Don't redirect if on setup page - let user complete the wizard
    if (isSetupPage) {
      return;
    }

    // If setup is complete but not authenticated, redirect to login
    if (!isAuthenticated && !inAuthGroup && !isLoginPage) {
      router.replace('/auth/login');
    } else if (isAuthenticated && (inAuthGroup || isLoginPage)) {
      router.replace('/');
    }
  }, [isAuthenticated, isInitialized, setupStatus, setupLoading, segments, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  // Memoize config to prevent unnecessary re-renders
  const apiConfig = useMemo(() => ({
    baseUrl: getApiBaseUrl(),
    getToken: getAccessToken,
    onAuthError: handleAuthError,
  }), []);

  return (
    <GluestackUIProvider mode="dark">
      <ApiProvider config={apiConfig}>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: {
                backgroundColor: '#18181b',
              },
            }}
          />
        </AuthGuard>
      </ApiProvider>
    </GluestackUIProvider>
  );
}

