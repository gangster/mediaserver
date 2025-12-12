/**
 * StatCard component
 *
 * Quick stats display card for the home page dashboard.
 * Shows a title, value, and icon.
 */

import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Card } from '../ui';

export interface StatCardProps {
  /** Card title */
  title: string;
  /** Display value */
  value: string | number;
  /** Icon element */
  icon: React.ReactNode;
  /** Background color class for icon container */
  color: string;
  /** Loading state */
  isLoading?: boolean;
  /** Navigation link */
  href?: string;
  /** Click handler */
  onPress?: () => void;
}

/**
 * StatCard component
 */
export function StatCard({
  title,
  value,
  icon,
  color,
  isLoading,
  href,
  onPress,
}: StatCardProps) {
  const content = (
    <Card
      variant="outline"
      size="lg"
      className="bg-zinc-900/50 border-zinc-800"
    >
      <View className="flex flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-zinc-400 text-sm">{title}</Text>
          {isLoading ? (
            <View className="h-8 w-16 mt-1 bg-zinc-800 rounded animate-pulse" />
          ) : (
            <Text className="text-2xl font-bold text-white mt-1">
              {value}
            </Text>
          )}
        </View>
        <View
          className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}
        >
          {icon}
        </View>
      </View>
    </Card>
  );

  if (href) {
    return (
      <Link href={href as '/movies'} asChild>
        <Pressable className="w-full active:opacity-80">{content}</Pressable>
      </Link>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="w-full active:opacity-80">
        {content}
      </Pressable>
    );
  }

  return content;
}

/**
 * Skeleton loader for StatCard
 */
export function StatCardSkeleton() {
  return (
    <Card
      variant="outline"
      size="lg"
      className="bg-zinc-900/50 border-zinc-800"
    >
      <View className="flex flex-row items-center justify-between">
        <View className="flex-1">
          <View className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
          <View className="h-8 w-16 mt-1 bg-zinc-800 rounded animate-pulse" />
        </View>
        <View className="w-10 h-10 rounded-xl bg-zinc-800 animate-pulse" />
      </View>
    </Card>
  );
}

export default StatCard;
