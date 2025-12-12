/**
 * Web App Root Layout
 *
 * Sets up providers and navigation for the web application.
 */

import { useEffect } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApiProvider } from '@mediaserver/api-client';
import { useAuth } from '../src/hooks/useAuth';

import '../global.css';

/**
 * Auth guard component that redirects based on auth state
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'setup';
    const isLoginPage = pathname === '/login' || pathname === '/auth/login';
    const isSetupPage = pathname.startsWith('/setup');

    if (!isAuthenticated && !inAuthGroup && !isLoginPage && !isSetupPage) {
      // Redirect to login if not authenticated
      router.replace('/auth/login');
    } else if (isAuthenticated && (inAuthGroup || isLoginPage)) {
      // Redirect to home if authenticated and on auth page
      router.replace('/');
    }
  }, [isAuthenticated, isInitialized, segments, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ApiProvider config={{ baseUrl: 'http://localhost:3000' }}>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: {
              backgroundColor: '#09090b',
            },
          }}
        />
      </AuthGuard>
    </ApiProvider>
  );
}

