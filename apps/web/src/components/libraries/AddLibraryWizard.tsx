/**
 * AddLibraryWizard - A multi-step modal wizard for creating media libraries.
 *
 * Steps:
 * 1. Type Selection (Movies or TV Shows)
 * 2. Name Input
 * 3. Paths Input with validation
 * 4. Success with scan option
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import {
  useCreateLibrary,
  useScanLibrary,
  useLibraries,
} from '@mediaserver/api-client';
import { TypeStep } from './steps/TypeStep';
import { NameStep } from './steps/NameStep';
import { PathsStep } from './steps/PathsStep';
import { SuccessStep } from './steps/SuccessStep';

export type LibraryType = 'movie' | 'tv';

export interface WizardData {
  type: LibraryType | null;
  name: string;
  paths: string[];
}

export interface AddLibraryWizardProps {
  /** Whether the wizard is open */
  isOpen: boolean;
  /** Called when the wizard should close */
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Choose Library Type',
  2: 'Name Your Library',
  3: 'Add Folder Paths',
  4: 'Library Created!',
};

/**
 * Progress indicator showing current step
 */
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  if (currentStep === 4) return null; // Hide on success step

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              step === currentStep
                ? '#10b981'
                : step < currentStep
                  ? 'rgba(16, 185, 129, 0.5)'
                  : '#52525b',
          }}
        />
      ))}
    </View>
  );
}

/**
 * Close button (X) for the modal
 */
function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
        borderRadius: 8,
        zIndex: 10,
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#71717a"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </Pressable>
  );
}

/**
 * AddLibraryWizard component
 */
export function AddLibraryWizard({ isOpen, onClose }: AddLibraryWizardProps) {
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<WizardStep>(1);
  const [data, setData] = useState<WizardData>({
    type: null,
    name: '',
    paths: [''],
  });
  const [createdLibraryId, setCreatedLibraryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createLibrary = useCreateLibrary();
  const scanLibrary = useScanLibrary();
  const { refetch: refetchLibraries } = useLibraries();

  const modalTopPadding = height * 0.12;
  const isMobile = width < 640;

  // Reset wizard state when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setData({ type: null, name: '', paths: [''] });
      setCreatedLibraryId(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts (Escape to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 4) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  // Update data helper
  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  // Navigation helpers
  const goNext = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, 4) as WizardStep);
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 1) as WizardStep);
  }, []);

  // Create library handler
  const handleCreate = useCallback(async () => {
    if (!data.type || !data.name || data.paths.length === 0) return;

    setError(null);

    try {
      const result = await createLibrary.mutateAsync({
        name: data.name,
        type: data.type,
        paths: data.paths.filter((p) => p.trim() !== ''),
        enabled: true,
      });

      setCreatedLibraryId(result.id);
      await refetchLibraries();
      setStep(4);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create library';
      setError(message);
    }
  }, [data, createLibrary, refetchLibraries]);

  // Scan and close handler
  const handleScanNow = useCallback(async () => {
    if (!createdLibraryId) {
      onClose();
      return;
    }

    try {
      await scanLibrary.mutateAsync({ id: createdLibraryId });
    } catch (err) {
      console.error('Failed to start scan:', err);
    }
    onClose();
  }, [createdLibraryId, scanLibrary, onClose]);

  // Check if current step is valid for navigation
  const isStepValid = useCallback(() => {
    switch (step) {
      case 1:
        return data.type !== null;
      case 2:
        return data.name.trim().length > 0 && data.name.length <= 100;
      case 3:
        // At least one non-empty valid path
        return data.paths.some((p) => p.trim().startsWith('/'));
      default:
        return true;
    }
  }, [step, data]);

  if (!isOpen) return null;

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: modalTopPadding,
      }}
    >
      {/* Backdrop with blur */}
      <Pressable
        onPress={step !== 4 ? onClose : undefined}
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
          } as const
        }
      />

      {/* Modal */}
      <View
        style={
          {
            width: isMobile ? '100%' : 500,
            maxWidth: isMobile ? undefined : 500,
            marginHorizontal: isMobile ? 16 : 0,
            backgroundColor: 'rgba(24, 24, 27, 0.98)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(63, 63, 70, 0.5)',
            overflow: 'hidden',
            zIndex: 51,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          } as const
        }
      >
        {/* Header */}
        <View style={{ position: 'relative', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          {step !== 4 && <CloseButton onPress={onClose} />}
          <StepIndicator currentStep={step} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
            {STEP_TITLES[step]}
          </Text>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
          {step === 1 && (
            <TypeStep
              selectedType={data.type}
              onSelect={(type) => updateData({ type, name: type === 'movie' ? 'Movies' : 'TV Shows' })}
            />
          )}
          {step === 2 && (
            <NameStep
              name={data.name}
              onChange={(name) => updateData({ name })}
              onSubmit={isStepValid() ? goNext : undefined}
            />
          )}
          {step === 3 && (
            <PathsStep
              paths={data.paths}
              onChange={(paths) => updateData({ paths })}
            />
          )}
          {step === 4 && (
            <SuccessStep
              libraryName={data.name}
              libraryType={data.type!}
              onScanNow={handleScanNow}
              onDone={onClose}
              isScanning={scanLibrary.isPending}
            />
          )}
        </View>

        {/* Error message */}
        {error && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: 12,
            }}>
              <Text style={{ color: '#f87171', fontSize: 14, textAlign: 'center' }}>{error}</Text>
            </View>
          </View>
        )}

        {/* Footer with navigation buttons */}
        {step !== 4 && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(63, 63, 70, 0.5)',
          }}>
            {step > 1 ? (
              <Pressable
                onPress={goBack}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Back</Text>
              </Pressable>
            ) : (
              <View />
            )}

            {step === 3 ? (
              <Pressable
                onPress={handleCreate}
                disabled={!isStepValid() || createLibrary.isPending}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isStepValid() && !createLibrary.isPending ? '#10b981' : '#3f3f46',
                  opacity: isStepValid() && !createLibrary.isPending ? 1 : 0.5,
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>
                  {createLibrary.isPending ? 'Creating...' : 'Create Library'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={goNext}
                disabled={!isStepValid()}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: isStepValid() ? '#10b981' : '#3f3f46',
                  opacity: isStepValid() ? 1 : 0.5,
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Next</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default AddLibraryWizard;
