/**
 * FilterDropdown component
 *
 * Dropdown for filtering media lists by genre, year, etc.
 * Adapted for React Native Web.
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDropdownProps {
  /** Label shown when nothing selected */
  label: string;
  /** Available options */
  options: FilterOption[];
  /** Currently selected value */
  selected?: string;
  /** Called when selection changes */
  onChange: (value: string | undefined) => void;
  /** Label for the "all" option */
  allLabel?: string;
}

/**
 * Filter dropdown with "All" option
 */
export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = 'All',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (value: string | undefined) => {
      onChange(value);
      setIsOpen(false);
    },
    [onChange]
  );

  const buttonStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: selected ? '#10b981' : '#27272a',
  };

  return (
    <View style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        style={({ pressed }) => [
          buttonStyle,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={{ color: selected ? '#fff' : '#d4d4d8', fontSize: 14 }}>
          {selected || label}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={selected ? '#fff' : '#d4d4d8'}
        />
      </Pressable>

      {isOpen && (
        <>
          {/* Backdrop */}
          <Pressable
            onPress={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            } as ViewStyle}
          />
          {/* Dropdown */}
          <View
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 180,
              maxHeight: 280,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 10,
            } as ViewStyle}
          >
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {/* All option */}
              <Pressable
                onPress={() => handleSelect(undefined)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: !selected ? '#10b981' : pressed ? '#3f3f46' : 'transparent',
                })}
              >
                <Text style={{ color: !selected ? '#fff' : '#d4d4d8', fontSize: 14 }}>
                  {allLabel}
                </Text>
              </Pressable>

              {/* Options */}
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor:
                      selected === option.value
                        ? '#10b981'
                        : pressed
                          ? '#3f3f46'
                          : 'transparent',
                  })}
                >
                  <Text
                    style={{
                      color: selected === option.value ? '#fff' : '#d4d4d8',
                      fontSize: 14,
                    }}
                  >
                    {option.label}
                  </Text>
                  {option.count !== undefined && (
                    <Text
                      style={{
                        color: selected === option.value ? 'rgba(255,255,255,0.7)' : '#71717a',
                        fontSize: 12,
                      }}
                    >
                      {option.count}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

export default FilterDropdown;

