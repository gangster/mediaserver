/**
 * Setup Wizard - First-run experience
 *
 * Guides users through initial server configuration:
 * 1. Welcome
 * 2. Create admin account
 * 3. Add first library (optional)
 * 4. Privacy settings
 * 5. Ready!
 *
 * Matches the behavior of the original Forreel setup wizard.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRANDING } from '@mediaserver/core';
import {
  useSetupStatus,
  useCreateOwner,
  useSetupAddLibrary,
  useSavePrivacySettings,
  useCompleteSetup,
  useLibraryUtils,
  useCreatePath,
} from '@mediaserver/api-client';

/** Wizard step type */
type Step = 'welcome' | 'account' | 'library' | 'privacy' | 'ready';

/** Library type */
type LibraryType = 'movie' | 'tv';

/** Library form data per type */
interface LibraryTypeData {
  name: string;
  path: string;
}

/** Privacy level */
type PrivacyLevel = 'maximum' | 'private' | 'balanced' | 'open';

/** Storage keys */
const SETUP_IN_PROGRESS_KEY = 'mediaserver_setup_in_progress';
const SETUP_WIZARD_STATE_KEY = 'mediaserver_setup_wizard_state';

/** Wizard state to persist */
interface WizardState {
  step: Step;
  libraryTypeData: Record<LibraryType, LibraryTypeData>;
  selectedLibraryType: LibraryType;
  createdLibraries: LibraryType[];
  privacyLevel: PrivacyLevel;
  accountEmail?: string;
}

/** Path validation state */
interface PathValidation {
  checked: boolean;
  exists: boolean;
  isDirectory: boolean;
  isWritable: boolean;
  parentExists: boolean;
  parentWritable: boolean;
  isChecking: boolean;
  error: string | null;
  justCreated: boolean;
}

/** Default library values */
const LIBRARY_DEFAULTS: Record<LibraryType, { name: string; defaultPath: string }> = {
  movie: { name: 'Movies', defaultPath: '/media/movies' },
  tv: { name: 'TV Shows', defaultPath: '/media/tv' },
};

/** Privacy options */
const PRIVACY_OPTIONS: Array<{
  level: PrivacyLevel;
  icon: string;
  title: string;
  desc: string;
  recommended?: boolean;
}> = [
  { level: 'maximum', icon: '🔒', title: 'Maximum', desc: 'No external connections' },
  { level: 'private', icon: '🛡️', title: 'Private', desc: 'Local only (Recommended)', recommended: true },
  { level: 'balanced', icon: '⚖️', title: 'Balanced', desc: 'Privacy with features' },
  { level: 'open', icon: '📊', title: 'Open', desc: 'Help improve the project' },
];

/** localStorage helpers */
function markSetupInProgress(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETUP_IN_PROGRESS_KEY, 'true');
  }
}

function clearSetupInProgress(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SETUP_IN_PROGRESS_KEY);
    localStorage.removeItem(SETUP_WIZARD_STATE_KEY);
  }
}

function saveWizardState(state: WizardState): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETUP_WIZARD_STATE_KEY, JSON.stringify(state));
  }
}

function loadWizardState(): WizardState | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(SETUP_WIZARD_STATE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as WizardState;
  } catch {
    return null;
  }
}

/** Progress bar component */
function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['welcome', 'account', 'library', 'privacy', 'ready'];
  const currentIndex = steps.indexOf(step);
  const progress = (currentIndex / (steps.length - 1)) * 100;

  if (step === 'welcome' || step === 'ready') return null;

  return (
    <View className="absolute top-0 left-0 right-0 h-1 bg-zinc-800 z-10">
      <View
        className="h-full bg-emerald-500"
        style={{ width: `${progress}%` }}
      />
    </View>
  );
}

/** Main Setup Wizard */
export default function SetupWizard() {
  // Load initial state from localStorage
  const [step, setStep] = useState<Step>(() => loadWizardState()?.step ?? 'welcome');
  const [accountEmail, setAccountEmail] = useState(() => loadWizardState()?.accountEmail ?? '');
  const [libraryTypeData, setLibraryTypeData] = useState<Record<LibraryType, LibraryTypeData>>(() =>
    loadWizardState()?.libraryTypeData ?? {
      movie: { name: LIBRARY_DEFAULTS.movie.name, path: LIBRARY_DEFAULTS.movie.defaultPath },
      tv: { name: LIBRARY_DEFAULTS.tv.name, path: LIBRARY_DEFAULTS.tv.defaultPath },
    }
  );
  const [selectedLibraryType, setSelectedLibraryType] = useState<LibraryType>(() =>
    loadWizardState()?.selectedLibraryType ?? 'movie'
  );
  const [createdLibraries, setCreatedLibraries] = useState<LibraryType[]>(() =>
    loadWizardState()?.createdLibraries ?? []
  );
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(() =>
    loadWizardState()?.privacyLevel ?? 'private'
  );

  // Path validation state per library type
  const [pathValidation, setPathValidation] = useState<Record<LibraryType, PathValidation>>({
    movie: { checked: false, exists: false, isDirectory: false, isWritable: false, parentExists: false, parentWritable: false, isChecking: false, error: null, justCreated: false },
    tv: { checked: false, exists: false, isDirectory: false, isWritable: false, parentExists: false, parentWritable: false, isChecking: false, error: null, justCreated: false },
  });

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [initialValidationDone, setInitialValidationDone] = useState(false);
  
  // Track if initial sync has been done - only validate step on first load
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  // API hooks
  const { data: status, isLoading: statusLoading } = useSetupStatus();
  const createOwner = useCreateOwner();
  const addLibrary = useSetupAddLibrary();
  const savePrivacy = useSavePrivacySettings();
  const completeSetup = useCompleteSetup();
  const createPath = useCreatePath();
  const libraryUtils = useLibraryUtils();

  // Current library data
  const currentLibraryData = libraryTypeData[selectedLibraryType];

  // Libraries that have paths filled in
  const librariesToCreate = (['movie', 'tv'] as LibraryType[]).filter(
    (type) => libraryTypeData[type].path.trim() !== ''
  );

  // Save wizard state whenever it changes
  const persistState = useCallback(() => {
    saveWizardState({
      step,
      libraryTypeData,
      selectedLibraryType,
      createdLibraries,
      privacyLevel,
      accountEmail,
    });
  }, [step, libraryTypeData, selectedLibraryType, createdLibraries, privacyLevel, accountEmail]);

  useEffect(() => {
    persistState();
  }, [persistState]);

  // Sync step with server status - only on initial load
  // This prevents users from manually navigating to a step they shouldn't be on
  useEffect(() => {
    if (statusLoading || !status || initialSyncDone) return;

    // Mark initial sync as done
    setInitialSyncDone(true);

    // If setup is complete, redirect to home
    if (status.isComplete) {
      router.replace('/');
      return;
    }

    // Validate current step against server state
    // If we're on library step or later but no owner exists, go back to account step
    if (!status.hasOwner && (step === 'library' || step === 'privacy' || step === 'ready')) {
      setStep('account');
      // Clear persisted state since it's out of sync
      clearSetupInProgress();
    }
  }, [status, statusLoading, step, initialSyncDone]);
  
  // Separate effect to handle redirect when setup is complete (can happen anytime)
  useEffect(() => {
    if (status?.isComplete) {
      router.replace('/');
    }
  }, [status?.isComplete]);

  /** Update library data for the selected type */
  const updateCurrentLibraryData = (updates: Partial<LibraryTypeData>) => {
    setLibraryTypeData((prev) => ({
      ...prev,
      [selectedLibraryType]: { ...prev[selectedLibraryType], ...updates },
    }));
    // Clear validation when path changes
    if (updates.path !== undefined) {
      setPathValidation((prev) => ({
        ...prev,
        [selectedLibraryType]: {
          ...prev[selectedLibraryType],
          checked: false,
          error: null,
          justCreated: false,
        },
      }));
    }
  };

  /** Validate a path on the server */
  const validatePath = useCallback(async (type: LibraryType): Promise<{ exists: boolean; isDirectory: boolean } | null> => {
    const pathToCheck = libraryTypeData[type].path.trim();
    if (!pathToCheck) return null;

    setPathValidation((prev) => ({
      ...prev,
      [type]: { ...prev[type], isChecking: true, error: null },
    }));

    try {
      const result = await libraryUtils.libraries.checkPath.fetch({ path: pathToCheck });
      setPathValidation((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          checked: true,
          exists: result.exists,
          isDirectory: result.isDirectory,
          isWritable: result.isWritable,
          parentExists: result.parentExists,
          parentWritable: result.parentWritable,
          isChecking: false,
          error: null,
        },
      }));
      return { exists: result.exists, isDirectory: result.isDirectory };
    } catch (err) {
      setPathValidation((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          checked: true,
          isChecking: false,
          error: err instanceof Error ? err.message : 'Failed to check path',
        },
      }));
      return null;
    }
  }, [libraryTypeData, libraryUtils]);

  /** Create a directory on the server */
  const handleCreateDirectory = useCallback(async (type: LibraryType) => {
    const pathToCreate = libraryTypeData[type].path.trim();
    if (!pathToCreate) return;

    try {
      const result = await createPath.mutateAsync({ path: pathToCreate });
      if (result.success) {
        setPathValidation((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            checked: true,
            exists: true,
            isDirectory: true,
            isWritable: true,
            isChecking: false,
            error: null,
            justCreated: true,
          },
        }));
        // Clear the "just created" flag after 3 seconds
        setTimeout(() => {
          setPathValidation((prev) => ({
            ...prev,
            [type]: { ...prev[type], justCreated: false },
          }));
        }, 3000);
      }
    } catch {
      // Error handled by mutation
    }
  }, [libraryTypeData, createPath]);

  // Validate pre-filled paths when entering library step
  useEffect(() => {
    if (step === 'library' && !initialValidationDone) {
      setInitialValidationDone(true);
      const timer = setTimeout(() => {
        (['movie', 'tv'] as LibraryType[]).forEach((type) => {
          const path = libraryTypeData[type].path.trim();
          if (path && path.startsWith('/')) {
            validatePath(type);
          }
        });
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, initialValidationDone, libraryTypeData, validatePath]);

  /** Handle account creation */
  const handleAccountSubmit = async () => {
    setError('');

    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await createOwner.mutateAsync({
        email,
        password,
        displayName: displayName || 'Admin',
      });
      setAccountEmail(email);
      markSetupInProgress();
      setStep('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  /** Handle library creation */
  const handleLibrarySubmit = async () => {
    setError('');

    if (librariesToCreate.length === 0) {
      setError('Please enter a folder path for at least one library');
      return;
    }

    // Validate all paths exist before creating libraries
    for (const type of librariesToCreate) {
      const validation = pathValidation[type];
      if (!validation.checked) {
        const result = await validatePath(type);
        if (!result || !result.exists) {
          setError(`The folder for ${type === 'movie' ? 'Movies' : 'TV Shows'} doesn&apos;t exist. Create it or choose a different path.`);
          setSelectedLibraryType(type);
          return;
        }
      } else if (!validation.exists) {
        setError(`The folder for ${type === 'movie' ? 'Movies' : 'TV Shows'} doesn&apos;t exist. Create it or choose a different path.`);
        setSelectedLibraryType(type);
        return;
      }
    }

    try {
      const created: LibraryType[] = [];
      for (const type of librariesToCreate) {
        const data = libraryTypeData[type];
        await addLibrary.mutateAsync({
          name: data.name || LIBRARY_DEFAULTS[type].name,
          path: data.path,
          type,
        });
        created.push(type);
      }
      setCreatedLibraries(created);
      setStep('privacy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create library');
    }
  };

  /** Handle finish */
  const handleFinish = async () => {
    try {
      await completeSetup.mutateAsync();
    } catch {
      // Continue anyway
    }
    clearSetupInProgress();
    router.replace('/');
  };

  if (statusLoading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-900 items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      <ProgressBar step={step} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Welcome Step */}
        {step === 'welcome' && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="mb-8">
              <Text className="text-5xl font-bold text-emerald-400 text-center">
                {BRANDING.name}
              </Text>
              <Text className="text-zinc-400 mt-2 text-center">{BRANDING.tagline}</Text>
            </View>

            <View className="bg-zinc-800/50 rounded-2xl p-8 mb-8 max-w-lg w-full">
              <Text className="text-2xl font-semibold text-white mb-4 text-center">
                Welcome to Your Media Server
              </Text>
              <Text className="text-zinc-400 mb-6 text-center">
                Let&apos;s get your server set up in just a few steps. You&apos;ll create your admin
                account, add your media libraries, and configure your privacy preferences.
              </Text>

              <View className="flex-row justify-around">
                <View className="items-center p-4">
                  <Text className="text-3xl mb-2">🔒</Text>
                  <Text className="text-sm text-zinc-400">Privacy First</Text>
                </View>
                <View className="items-center p-4">
                  <Text className="text-3xl mb-2">🎬</Text>
                  <Text className="text-sm text-zinc-400">Your Media</Text>
                </View>
                <View className="items-center p-4">
                  <Text className="text-3xl mb-2">🏠</Text>
                  <Text className="text-sm text-zinc-400">Self-Hosted</Text>
                </View>
              </View>
            </View>

            <Pressable
              className="w-full max-w-lg py-4 px-6 bg-emerald-600 active:bg-emerald-500 rounded-xl"
              onPress={() => setStep('account')}
            >
              <Text className="text-white font-medium text-lg text-center">Get Started</Text>
            </Pressable>
          </View>
        )}

        {/* Account Step */}
        {step === 'account' && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-full max-w-md">
              <View className="mb-8">
                <Text className="text-2xl font-bold text-white text-center">Create Admin Account</Text>
                <Text className="text-zinc-400 mt-2 text-center">
                  This will be the first administrator of your server.
                </Text>
              </View>

              {error && (
                <View className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Text className="text-red-400 text-sm">{error}</Text>
                  <Pressable onPress={() => setError('')}>
                    <Text className="text-red-400/60 text-xs mt-1">Dismiss</Text>
                  </Pressable>
                </View>
              )}

              <View className="gap-5">
                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">
                    Display Name <Text className="text-zinc-500">(optional)</Text>
                  </Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white"
                    placeholder="Admin"
                    placeholderTextColor="#71717a"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Email</Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white"
                    placeholder="admin@example.com"
                    placeholderTextColor="#71717a"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Password</Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white"
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                  <Text className="text-zinc-500 text-xs mt-1">At least 8 characters</Text>
                </View>

                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Confirm Password</Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white"
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                <View className="flex-row gap-4 pt-4">
                  <Pressable
                    className="flex-1 py-3 px-4 rounded-lg border border-zinc-700 active:border-zinc-600"
                    onPress={() => setStep('welcome')}
                  >
                    <Text className="text-zinc-400 text-center font-medium">Back</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 active:bg-emerald-500"
                    onPress={handleAccountSubmit}
                    disabled={createOwner.isPending}
                  >
                    {createOwner.isPending ? (
                      <View className="flex-row items-center justify-center gap-2">
                        <ActivityIndicator color="white" size="small" />
                        <Text className="text-white font-medium">Creating...</Text>
                      </View>
                    ) : (
                      <Text className="text-white text-center font-medium">Continue</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Library Step */}
        {step === 'library' && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-full max-w-md">
              <View className="mb-8">
                <Text className="text-2xl font-bold text-white text-center">Add Your First Library</Text>
                <Text className="text-zinc-400 mt-2 text-center">
                  Tell {BRANDING.name} where your media files are located.
                </Text>
              </View>

              {error && (
                <View className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Text className="text-red-400 text-sm">{error}</Text>
                  <Pressable onPress={() => setError('')}>
                    <Text className="text-red-400/60 text-xs mt-1">Dismiss</Text>
                  </Pressable>
                </View>
              )}

              <View className="gap-5">
                {/* Library Type Selector */}
                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Library Type</Text>
                  <View className="flex-row gap-4">
                    {(['movie', 'tv'] as LibraryType[]).map((type) => (
                      <Pressable
                        key={type}
                        className={`flex-1 p-4 rounded-lg border-2 items-center relative ${
                          selectedLibraryType === type
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : libraryTypeData[type].path.trim()
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-zinc-700'
                        }`}
                        onPress={() => setSelectedLibraryType(type)}
                      >
                        {libraryTypeData[type].path.trim() && (
                          <Text className="absolute top-2 right-2 text-emerald-400 text-sm">✓</Text>
                        )}
                        <Text className="text-2xl mb-1">{type === 'movie' ? '🎬' : '📺'}</Text>
                        <Text className="text-white font-medium">{type === 'movie' ? 'Movies' : 'TV Shows'}</Text>
                        {libraryTypeData[type].path.trim() && selectedLibraryType !== type && (
                          <Text className="text-xs text-zinc-500 mt-1" numberOfLines={1}>
                            {libraryTypeData[type].path}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Library Name */}
                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Library Name</Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white"
                    placeholder={LIBRARY_DEFAULTS[selectedLibraryType].name}
                    placeholderTextColor="#71717a"
                    value={currentLibraryData.name}
                    onChangeText={(text) => updateCurrentLibraryData({ name: text })}
                  />
                </View>

                {/* Folder Path */}
                <View>
                  <Text className="text-sm font-medium text-zinc-300 mb-2">Folder Path</Text>
                  <View className="relative">
                    <TextInput
                      className={`w-full px-4 py-3 pr-10 rounded-lg bg-zinc-800/50 border text-white font-mono ${
                        currentLibraryData.path && !currentLibraryData.path.startsWith('/')
                          ? 'border-amber-500/50'
                          : pathValidation[selectedLibraryType].checked && !pathValidation[selectedLibraryType].exists
                            ? 'border-amber-500/50'
                            : pathValidation[selectedLibraryType].checked && pathValidation[selectedLibraryType].exists
                              ? 'border-emerald-500/50'
                              : 'border-zinc-700'
                      }`}
                      placeholder={LIBRARY_DEFAULTS[selectedLibraryType].defaultPath}
                      placeholderTextColor="#71717a"
                      value={currentLibraryData.path}
                      onChangeText={(text) => updateCurrentLibraryData({ path: text })}
                      onBlur={() => {
                        if (currentLibraryData.path.trim() && currentLibraryData.path.startsWith('/')) {
                          validatePath(selectedLibraryType);
                        }
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {pathValidation[selectedLibraryType].isChecking && (
                      <View className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ActivityIndicator size="small" color="#10b981" />
                      </View>
                    )}
                    {!pathValidation[selectedLibraryType].isChecking && pathValidation[selectedLibraryType].checked && pathValidation[selectedLibraryType].exists && (
                      <Text className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">✓</Text>
                    )}
                  </View>

                  {/* Validation Messages */}
                  {currentLibraryData.path && !currentLibraryData.path.startsWith('/') ? (
                    <Text className="text-amber-400 text-xs mt-2">⚠️ Path must be absolute (start with /)</Text>
                  ) : pathValidation[selectedLibraryType].error ? (
                    <Text className="text-red-400 text-xs mt-2">{pathValidation[selectedLibraryType].error}</Text>
                  ) : pathValidation[selectedLibraryType].justCreated && pathValidation[selectedLibraryType].exists ? (
                    <View className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <Text className="text-emerald-400 text-sm">✓ Folder created successfully!</Text>
                    </View>
                  ) : pathValidation[selectedLibraryType].checked && !pathValidation[selectedLibraryType].exists ? (
                    <View className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <Text className="text-amber-400 text-sm">📁 This folder doesn&apos;t exist yet</Text>
                      {pathValidation[selectedLibraryType].parentWritable ? (
                        <Pressable
                          className="mt-2 px-3 py-1.5 bg-amber-500/20 active:bg-amber-500/30 rounded-md self-start flex-row items-center gap-2"
                          onPress={() => handleCreateDirectory(selectedLibraryType)}
                          disabled={createPath.isPending}
                        >
                          {createPath.isPending ? (
                            <>
                              <ActivityIndicator size="small" color="#fcd34d" />
                              <Text className="text-amber-300 text-sm">Creating...</Text>
                            </>
                          ) : (
                            <Text className="text-amber-300 text-sm">+ Create this folder</Text>
                          )}
                        </Pressable>
                      ) : !pathValidation[selectedLibraryType].parentExists ? (
                        <Text className="text-amber-400/70 text-xs mt-1">
                          Parent directory doesn&apos;t exist. Check that the path is correct.
                        </Text>
                      ) : (
                        <Text className="text-amber-400/70 text-xs mt-1">
                          Cannot create folder - no write permission to parent directory.
                        </Text>
                      )}
                    </View>
                  ) : pathValidation[selectedLibraryType].checked && pathValidation[selectedLibraryType].exists ? (
                    <Text className="text-emerald-400 text-xs mt-2">✓ Folder exists and is accessible</Text>
                  ) : (
                    <Text className="text-zinc-500 text-xs mt-2">
                      The folder where your {selectedLibraryType === 'movie' ? 'movies' : 'TV shows'} are stored
                    </Text>
                  )}
                </View>

                {/* Libraries Summary */}
                {librariesToCreate.length > 0 && (
                  <View className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                    <Text className="text-xs text-zinc-400 mb-2">Libraries to create:</Text>
                    {librariesToCreate.map((type) => (
                      <View key={type} className="flex-row items-center gap-2">
                        <Text className="text-emerald-400">✓</Text>
                        <Text className="text-white text-sm">
                          {libraryTypeData[type].name || LIBRARY_DEFAULTS[type].name}
                        </Text>
                        <Text className="text-zinc-500 text-sm">({type === 'movie' ? 'Movies' : 'TV Shows'})</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Buttons */}
                <View className="flex-row gap-4 pt-4">
                  <Pressable
                    className="flex-1 py-3 px-4 rounded-lg border border-zinc-700 active:border-zinc-600"
                    onPress={() => {
                      setCreatedLibraries([]);
                      setStep('privacy');
                    }}
                    disabled={addLibrary.isPending}
                  >
                    <Text className="text-zinc-400 text-center font-medium">Skip for now</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 active:bg-emerald-500"
                    onPress={handleLibrarySubmit}
                    disabled={addLibrary.isPending}
                  >
                    {addLibrary.isPending ? (
                      <View className="flex-row items-center justify-center gap-2">
                        <ActivityIndicator color="white" size="small" />
                        <Text className="text-white font-medium">Creating...</Text>
                      </View>
                    ) : (
                      <Text className="text-white text-center font-medium">
                        {librariesToCreate.length > 1 ? `Add ${librariesToCreate.length} Libraries` : 'Add Library'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Privacy Step */}
        {step === 'privacy' && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-full max-w-2xl">
              <View className="mb-8">
                <Text className="text-2xl font-bold text-white text-center">Privacy Settings</Text>
                <Text className="text-zinc-400 mt-2 text-center">
                  Choose your preferred privacy level. You can change this anytime.
                </Text>
              </View>

              <View className="gap-4 mb-8">
                {PRIVACY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.level}
                    className={`p-4 rounded-xl border-2 ${
                      privacyLevel === option.level
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 active:border-zinc-600'
                    }`}
                    onPress={() => setPrivacyLevel(option.level)}
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-2xl">{option.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-white font-medium">{option.title}</Text>
                        <Text className="text-sm text-zinc-400">{option.desc}</Text>
                      </View>
                      {option.recommended && (
                        <View className="px-2 py-1 bg-emerald-500/20 rounded">
                          <Text className="text-emerald-400 text-xs">Recommended</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>

              <View className="p-4 bg-zinc-800/50 rounded-lg mb-8">
                <Text className="text-white font-medium mb-2">🔐 Our Promise</Text>
                <Text className="text-sm text-zinc-400">
                  {BRANDING.name} will <Text className="text-white font-medium">never</Text> sell your data,
                  require cloud accounts, or include ads. Your media server is yours alone.
                </Text>
              </View>

              <View className="flex-row gap-4">
                <Pressable
                  className="flex-1 py-3 px-4 rounded-lg border border-zinc-700 active:border-zinc-600"
                  onPress={() => setStep('library')}
                  disabled={savePrivacy.isPending}
                >
                  <Text className="text-zinc-400 text-center font-medium">Back</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-3 px-4 rounded-lg ${savePrivacy.isPending ? 'bg-emerald-600/50' : 'bg-emerald-600 active:bg-emerald-500'}`}
                  onPress={async () => {
                    try {
                      await savePrivacy.mutateAsync({ level: privacyLevel });
                      setStep('ready');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to save privacy settings');
                    }
                  }}
                  disabled={savePrivacy.isPending}
                >
                  {savePrivacy.isPending ? (
                    <View className="flex-row items-center justify-center gap-2">
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-white font-medium">Saving...</Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-medium">Continue</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Ready Step */}
        {step === 'ready' && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="max-w-lg items-center w-full">
              <Text className="text-6xl mb-6">🎉</Text>
              <Text className="text-3xl font-bold text-white mb-4 text-center">You&apos;re All Set!</Text>
              <Text className="text-zinc-400 mb-8 text-center">
                {BRANDING.name} is ready to use. Your media server is now configured and running.
                {createdLibraries.length > 0 && ' You can trigger a library scan from the Libraries page.'}
              </Text>

              <View className="bg-zinc-800/50 rounded-xl p-6 mb-8 w-full">
                <Text className="text-white font-medium mb-4">Quick Summary</Text>
                <View className="gap-3">
                  <View className="flex-row justify-between">
                    <Text className="text-zinc-400 text-sm">Admin Account</Text>
                    <Text className="text-white text-sm">{accountEmail}</Text>
                  </View>
                  {createdLibraries.length > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-sm">
                        {createdLibraries.length === 1 ? 'Library' : 'Libraries'}
                      </Text>
                      <Text className="text-white text-sm">
                        {createdLibraries.map((type) =>
                          `${libraryTypeData[type].name || LIBRARY_DEFAULTS[type].name} (${type === 'movie' ? 'Movies' : 'TV Shows'})`
                        ).join(', ')}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between">
                    <Text className="text-zinc-400 text-sm">Privacy Level</Text>
                    <Text className="text-white text-sm capitalize">{privacyLevel}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                className="w-full py-4 px-6 bg-emerald-600 active:bg-emerald-500 rounded-xl"
                onPress={handleFinish}
                disabled={completeSetup.isPending}
              >
                {completeSetup.isPending ? (
                  <View className="flex-row items-center justify-center gap-2">
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-medium text-lg">Launching...</Text>
                  </View>
                ) : (
                  <Text className="text-white font-medium text-lg text-center">
                    Start Using {BRANDING.name}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
