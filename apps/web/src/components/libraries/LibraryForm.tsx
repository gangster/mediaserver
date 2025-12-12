/**
 * Library Form Slide-out Panel
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { trpc } from '@mediaserver/api-client';
import type { Library } from '../../../app/libraries';

interface LibraryFormProps {
  isOpen: boolean;
  library: Library | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  type: 'movie' | 'tv';
  path: string;
}

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

export function LibraryForm({ isOpen, library, onClose, onSuccess }: LibraryFormProps) {
  const isEditing = !!library;
  const trpcUtils = trpc.useUtils();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'movie',
    path: '/media/movies',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [pathValidation, setPathValidation] = useState<PathValidation>({
    checked: false,
    exists: false,
    isDirectory: false,
    isWritable: false,
    parentExists: false,
    parentWritable: false,
    isChecking: false,
    error: null,
    justCreated: false,
  });

  const createMutation = trpc.libraries.create.useMutation();
  const updateMutation = trpc.libraries.update.useMutation();
  const createPathMutation = trpc.libraries.createPath.useMutation();

  useEffect(() => {
    if (isOpen) {
      if (library) {
        // Parse paths - may be JSON string or already an array
        const parsedPaths: string[] = Array.isArray(library.paths)
          ? library.paths
          : typeof library.paths === 'string'
            ? JSON.parse(library.paths)
            : [];
        setFormData({ name: library.name, type: library.type, path: parsedPaths[0] || '' });
        setPathValidation({
          checked: true, exists: true, isDirectory: true, isWritable: true,
          parentExists: true, parentWritable: true, isChecking: false, error: null, justCreated: false,
        });
      } else {
        setFormData({ name: '', type: 'movie', path: '/media/movies' });
        setPathValidation({
          checked: false, exists: false, isDirectory: false, isWritable: false,
          parentExists: false, parentWritable: false, isChecking: false, error: null, justCreated: false,
        });
      }
      setErrors({});
    }
  }, [isOpen, library]);

  useEffect(() => {
    if (!isEditing && isOpen) {
      const defaultPath = formData.type === 'movie' ? '/media/movies' : '/media/tv';
      setFormData((prev) => ({ ...prev, path: defaultPath }));
      setPathValidation((prev) => ({ ...prev, checked: false, justCreated: false }));
    }
  }, [formData.type, isEditing, isOpen]);

  const validatePath = useCallback(async (path: string) => {
    if (!path) return;
    setPathValidation((prev) => ({ ...prev, isChecking: true, error: null }));
    try {
      const result = await trpcUtils.libraries.checkPath.fetch({ path });
      setPathValidation((prev) => ({
        ...prev, checked: true, exists: result.exists, isDirectory: result.isDirectory,
        isWritable: result.isWritable, parentExists: result.parentExists,
        parentWritable: result.parentWritable, isChecking: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate path';
      if (!message.includes('Authentication')) {
        setPathValidation((prev) => ({ ...prev, checked: true, isChecking: false, error: message }));
      } else {
        setPathValidation((prev) => ({ ...prev, isChecking: false }));
      }
    }
  }, [trpcUtils]);

  const handlePathBlur = () => {
    if (formData.path) validatePath(formData.path);
  };

  const handlePathChange = (text: string) => {
    setFormData((prev) => ({ ...prev, path: text }));
    setPathValidation((prev) => ({ ...prev, checked: false, justCreated: false }));
  };

  const handleCreateDirectory = async () => {
    if (!formData.path) return;
    try {
      await createPathMutation.mutateAsync({ path: formData.path });
      setPathValidation((prev) => ({ ...prev, exists: true, isDirectory: true, isWritable: true, justCreated: true }));
      setTimeout(() => setPathValidation((prev) => ({ ...prev, justCreated: false })), 3000);
    } catch { /* handled by mutation */ }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    else if (formData.name.length > 100) newErrors.name = 'Name is too long';
    if (!formData.path.trim()) newErrors.path = 'Path is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!pathValidation.exists || !pathValidation.isDirectory) {
      await validatePath(formData.path);
      return;
    }
    try {
      if (isEditing && library) {
        await updateMutation.mutateAsync({ id: library.id, data: { name: formData.name, type: formData.type, paths: [formData.path] } });
      } else {
        await createMutation.mutateAsync({ name: formData.name, type: formData.type, paths: [formData.path] });
      }
      onSuccess();
    } catch { /* handled by mutation */ }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;
  const showCreateButton = pathValidation.checked && !pathValidation.exists && pathValidation.parentExists && pathValidation.parentWritable;

  return (
    <>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{ position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40 }}
      />

      {/* Panel */}
      <View
        style={{
          position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480,
          backgroundColor: '#18181b', borderLeftWidth: 1, borderLeftColor: '#27272a', zIndex: 50,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#27272a',
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff' }}>{isEditing ? 'Edit Library' : 'Add Library'}</Text>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Feather name="x" size={22} color="#a1a1aa" />
          </Pressable>
        </View>

        {/* Form */}
        <ScrollView style={{ flex: 1, padding: 24 }}>
          {/* Name */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#d4d4d8', marginBottom: 8 }}>Library Name</Text>
            <TextInput
              value={formData.name}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
              placeholder="e.g., Movies, TV Shows, Anime"
              placeholderTextColor="#52525b"
              style={{
                paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
                backgroundColor: '#27272a', color: '#ffffff', borderWidth: 1,
                borderColor: errors.name ? '#ef4444' : '#3f3f46',
              }}
            />
            {errors.name && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.name}</Text>}
          </View>

          {/* Type */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#d4d4d8', marginBottom: 12 }}>Library Type</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setFormData((prev) => ({ ...prev, type: 'movie' }))}
                style={{
                  flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2,
                  borderColor: formData.type === 'movie' ? '#6366f1' : '#3f3f46',
                  backgroundColor: formData.type === 'movie' ? 'rgba(99, 102, 241, 0.1)' : '#27272a',
                  position: 'relative',
                }}
              >
                <View
                  style={{
                    width: 48, height: 48, borderRadius: 12, marginBottom: 8,
                    backgroundColor: formData.type === 'movie' ? 'rgba(99, 102, 241, 0.2)' : '#3f3f46',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="movie-open" size={24} color={formData.type === 'movie' ? '#818cf8' : '#a1a1aa'} />
                </View>
                <Text style={{ fontWeight: '500', color: formData.type === 'movie' ? '#ffffff' : '#a1a1aa' }}>Movies</Text>
                {formData.type === 'movie' && (
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Feather name="check" size={18} color="#818cf8" />
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => setFormData((prev) => ({ ...prev, type: 'tv' }))}
                style={{
                  flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2,
                  borderColor: formData.type === 'tv' ? '#a855f7' : '#3f3f46',
                  backgroundColor: formData.type === 'tv' ? 'rgba(168, 85, 247, 0.1)' : '#27272a',
                  position: 'relative',
                }}
              >
                <View
                  style={{
                    width: 48, height: 48, borderRadius: 12, marginBottom: 8,
                    backgroundColor: formData.type === 'tv' ? 'rgba(168, 85, 247, 0.2)' : '#3f3f46',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="tv" size={24} color={formData.type === 'tv' ? '#c084fc' : '#a1a1aa'} />
                </View>
                <Text style={{ fontWeight: '500', color: formData.type === 'tv' ? '#ffffff' : '#a1a1aa' }}>TV Shows</Text>
                {formData.type === 'tv' && (
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Feather name="check" size={18} color="#c084fc" />
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Path */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#d4d4d8', marginBottom: 8 }}>Folder Path</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                value={formData.path}
                onChangeText={handlePathChange}
                onBlur={handlePathBlur}
                placeholder={formData.type === 'movie' ? '/media/movies' : '/media/tv'}
                placeholderTextColor="#52525b"
                style={{
                  paddingHorizontal: 16, paddingVertical: 12, paddingRight: 40, borderRadius: 8,
                  backgroundColor: '#27272a', color: '#ffffff', fontFamily: 'monospace', fontSize: 14,
                  borderWidth: 1,
                  borderColor: errors.path ? '#ef4444' : pathValidation.checked && pathValidation.exists ? '#10b981' : '#3f3f46',
                }}
              />
              <View style={{ position: 'absolute', right: 12, top: 14 }}>
                {pathValidation.isChecking && <Feather name="loader" size={18} color="#a1a1aa" />}
                {pathValidation.checked && !pathValidation.isChecking && pathValidation.exists && (
                  <Feather name="check" size={18} color="#10b981" />
                )}
              </View>
            </View>
            {errors.path && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.path}</Text>}

            {pathValidation.justCreated && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Feather name="check" size={16} color="#10b981" />
                <Text style={{ color: '#10b981', fontSize: 14 }}>Folder created successfully!</Text>
              </View>
            )}

            {showCreateButton && !pathValidation.justCreated && (
              <View
                style={{
                  marginTop: 12, padding: 12, borderRadius: 8,
                  backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)',
                }}
              >
                <Text style={{ color: '#fcd34d', fontSize: 14, marginBottom: 8 }}>This folder doesn't exist yet.</Text>
                <Pressable
                  onPress={handleCreateDirectory}
                  disabled={createPathMutation.isPending}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#d97706', borderRadius: 8,
                    alignSelf: 'flex-start', opacity: createPathMutation.isPending ? 0.5 : 1,
                  }}
                >
                  <Feather name="folder-plus" size={16} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>
                    {createPathMutation.isPending ? 'Creating...' : 'Create this folder'}
                  </Text>
                </Pressable>
              </View>
            )}

            {pathValidation.error && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Feather name="alert-circle" size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 14 }}>{pathValidation.error}</Text>
              </View>
            )}
            {createPathMutation.error && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Feather name="alert-circle" size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 14 }}>{createPathMutation.error.message}</Text>
              </View>
            )}
          </View>

          {/* Submit error */}
          {submitError && (
            <View
              style={{
                padding: 16, borderRadius: 8, marginBottom: 24,
                backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
                flexDirection: 'row', alignItems: 'center', gap: 10,
              }}
            >
              <Feather name="alert-circle" size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, flex: 1 }}>{submitError.message}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#27272a',
            flexDirection: 'row', justifyContent: 'flex-end', gap: 12,
          }}
        >
          <Pressable onPress={onClose} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: '#a1a1aa', fontWeight: '500' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#6366f1', borderRadius: 8,
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '500' }}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Library'}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
