/**
 * Libraries Management Page
 *
 * Admin page for managing media libraries.
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Layout } from '../src/components/layout';
import { useAuth } from '../src/hooks/useAuth';
import { useLibraries, useScanLibrary } from '@mediaserver/api-client';

export default function LibrariesPage() {
  const { isAdmin, isInitialized } = useAuth();
  const { data: libraries, isLoading, refetch } = useLibraries();
  const scanLibrary = useScanLibrary();

  // Redirect non-admins
  if (isInitialized && !isAdmin) {
    return <Redirect href="/" />;
  }

  const handleScan = async (libraryId: string) => {
    try {
      await scanLibrary.mutateAsync({ libraryId });
      refetch();
    } catch (error) {
      console.error('Failed to scan library:', error);
    }
  };

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-950">
        {/* Header */}
        <View className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <View className="flex flex-row items-center justify-between">
            <View>
              <Text className="text-2xl sm:text-3xl font-bold text-white">
                Libraries
              </Text>
              <Text className="text-zinc-400 mt-1">
                Manage your media libraries
              </Text>
            </View>
            <Pressable className="flex flex-row items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg active:bg-emerald-700">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <Text className="text-white font-medium">Add Library</Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 sm:px-6 lg:px-8 pb-8">
          {isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : libraries?.length === 0 ? (
            <View className="items-center py-16 bg-zinc-900 rounded-xl border border-zinc-800">
              <View className="w-16 h-16 mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-zinc-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </View>
              <Text className="text-zinc-400 text-lg">No libraries yet</Text>
              <Text className="text-zinc-500 mt-1">
                Add a library to start scanning your media
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {libraries?.map((library: { id: string; name: string; type: string; path: string }) => (
                <View
                  key={library.id}
                  className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"
                >
                  <View className="flex flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex flex-row items-center gap-2">
                        <Text className="text-lg font-semibold text-white">
                          {library.name}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded-full ${
                            library.type === 'movies'
                              ? 'bg-indigo-600/20'
                              : 'bg-purple-600/20'
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              library.type === 'movies'
                                ? 'text-indigo-400'
                                : 'text-purple-400'
                            }`}
                          >
                            {library.type === 'movies' ? 'Movies' : 'TV Shows'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-zinc-400 text-sm mt-1">
                        {library.path}
                      </Text>
                    </View>
                    <View className="flex flex-row gap-2">
                      <Pressable
                        onPress={() => handleScan(library.id)}
                        disabled={scanLibrary.isPending}
                        className="px-3 py-2 bg-zinc-800 rounded-lg active:bg-zinc-700"
                      >
                        <Text className="text-white text-sm">Scan</Text>
                      </Pressable>
                      <Pressable className="px-3 py-2 bg-zinc-800 rounded-lg active:bg-zinc-700">
                        <svg
                          className="w-5 h-5 text-zinc-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}
