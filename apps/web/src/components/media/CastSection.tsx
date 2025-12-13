/**
 * CastSection component
 *
 * Displays cast and crew members in horizontal scrolling layouts with photos.
 * Adapted from forreel for React Native for Web.
 */

import { useRef, useState, useCallback } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Cast member data */
export interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath?: string | null;
  order: number;
}

/** Crew member data */
export interface CrewMember {
  id: string;
  name: string;
  job: string;
  department: string;
  profilePath?: string | null;
}

/** Guest star data (same as CastMember but for episodes) */
export interface GuestStar {
  id: string;
  name: string;
  character?: string;
  profilePath?: string | null;
  order?: number;
}

interface CastSectionProps {
  cast: CastMember[];
  crew?: CrewMember[];
  isLoading?: boolean;
  maxCast?: number;
  maxCrew?: number;
  /** Override layout mode */
  layout?: 'combined' | 'separate';
}

interface GuestStarsSectionProps {
  guestStars: GuestStar[];
  isLoading?: boolean;
  maxGuests?: number;
}

/**
 * Get TMDb profile image URL
 */
function getProfileUrl(profilePath: string | undefined | null): string {
  if (!profilePath) return '';
  return `https://image.tmdb.org/t/p/w185${profilePath}`;
}

/**
 * Person card component - used for cast, crew, and guest stars
 */
function PersonCard({
  name,
  subtitle,
  profilePath,
}: {
  name: string;
  subtitle: string;
  profilePath?: string | null;
}) {
  const [imageError, setImageError] = useState(false);
  const profileUrl = getProfileUrl(profilePath);
  const hasImage = profileUrl && !imageError;

  return (
    <View style={styles.personCard}>
      {/* Photo */}
      <View style={styles.personPhoto}>
        {hasImage ? (
          <Image
            source={{ uri: profileUrl }}
            style={styles.personImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.personPlaceholder}>
            <Text style={styles.personInitial}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={styles.personName} numberOfLines={1}>
        {name}
      </Text>

      {/* Subtitle (character or job) */}
      <Text style={styles.personSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

/**
 * Card skeleton for loading state
 */
function CardSkeleton() {
  return (
    <View style={styles.personCard}>
      <View style={[styles.personPhoto, styles.skeleton]} />
      <View style={[styles.skeletonText, { width: '100%', marginBottom: 4 }]} />
      <View style={[styles.skeletonText, { width: '75%' }]} />
    </View>
  );
}

/**
 * Scroll button component
 */
function ScrollButton({
  direction,
  onPress,
  visible,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.scrollButton,
        direction === 'left' ? styles.scrollButtonLeft : styles.scrollButtonRight,
      ]}
    >
      <Ionicons
        name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color="#ffffff"
      />
    </Pressable>
  );
}

/**
 * Scrollable row component - horizontal scroll row with arrow buttons
 */
function ScrollableRow({
  children,
  showButtons = true,
}: {
  children: React.ReactNode;
  showButtons?: boolean;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number }; contentSize: { width: number }; layoutMeasurement: { width: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCanScrollLeft(contentOffset.x > 10);
    setCanScrollRight(contentOffset.x < contentSize.width - layoutMeasurement.width - 10);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollViewRef.current) return;
    // @ts-ignore - scrollTo exists on web
    const scrollAmount = 400;
    scrollViewRef.current.scrollTo?.({
      x: direction === 'left' ? -scrollAmount : scrollAmount,
      animated: true,
    });
  };

  return (
    <View
      style={styles.scrollContainer}
      // @ts-ignore - web-only props
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showButtons && isHovered && (
        <ScrollButton
          direction="left"
          onPress={() => scroll('left')}
          visible={canScrollLeft}
        />
      )}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>

      {showButtons && isHovered && (
        <ScrollButton
          direction="right"
          onPress={() => scroll('right')}
          visible={canScrollRight}
        />
      )}
    </View>
  );
}

/**
 * Get unique key crew members with their primary job
 */
function getKeyCrewMembers(crew: CrewMember[], maxCrew: number): CrewMember[] {
  const rolePriority = [
    'Director',
    'Creator',
    'Showrunner',
    'Writer',
    'Screenplay',
    'Story',
    'Executive Producer',
    'Producer',
    'Director of Photography',
    'Cinematographer',
    'Original Music Composer',
    'Composer',
    'Editor',
    'Production Design',
    'Costume Design',
  ];

  const keyCrew = crew.filter((c) => rolePriority.includes(c.job));

  const personMap = new Map<string, CrewMember>();

  for (const member of keyCrew) {
    const existing = personMap.get(member.id);
    if (!existing) {
      personMap.set(member.id, member);
    } else {
      const existingPriority = rolePriority.indexOf(existing.job);
      const newPriority = rolePriority.indexOf(member.job);
      if (newPriority < existingPriority) {
        personMap.set(member.id, member);
      }
    }
  }

  const uniqueCrew = Array.from(personMap.values());
  uniqueCrew.sort((a, b) => {
    const aPriority = rolePriority.indexOf(a.job);
    const bPriority = rolePriority.indexOf(b.job);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name);
  });

  return uniqueCrew.slice(0, maxCrew);
}

/**
 * CastSection component - displays cast and crew
 */
export function CastSection({
  cast,
  crew,
  isLoading,
  maxCast = 15,
  maxCrew = 15,
  layout = 'separate',
}: CastSectionProps) {
  const displayCast = cast.slice(0, maxCast);
  const displayCrew = crew ? getKeyCrewMembers(crew, maxCrew) : [];

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cast & Crew</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.scrollContent}>
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // No data
  if (displayCast.length === 0 && displayCrew.length === 0) {
    return null;
  }

  // Combined layout
  if (layout === 'combined') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cast & Crew</Text>
        <ScrollableRow>
          {displayCast.map((member) => (
            <PersonCard
              key={`cast-${member.id}`}
              name={member.name}
              subtitle={member.character}
              profilePath={member.profilePath}
            />
          ))}
          {displayCrew.map((member, index) => (
            <PersonCard
              key={`crew-${member.id}-${index}`}
              name={member.name}
              subtitle={member.job}
              profilePath={member.profilePath}
            />
          ))}
        </ScrollableRow>
      </View>
    );
  }

  // Separate layout (default)
  return (
    <View style={styles.section}>
      {/* Cast section */}
      {displayCast.length > 0 && (
        <View style={styles.subsection}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <ScrollableRow>
            {displayCast.map((member) => (
              <PersonCard
                key={`cast-${member.id}`}
                name={member.name}
                subtitle={member.character}
                profilePath={member.profilePath}
              />
            ))}
          </ScrollableRow>
        </View>
      )}

      {/* Crew section */}
      {displayCrew.length > 0 && (
        <View style={styles.subsection}>
          <Text style={styles.sectionTitle}>Crew</Text>
          <ScrollableRow>
            {displayCrew.map((member, index) => (
              <PersonCard
                key={`crew-${member.id}-${index}`}
                name={member.name}
                subtitle={member.job}
                profilePath={member.profilePath}
              />
            ))}
          </ScrollableRow>
        </View>
      )}
    </View>
  );
}

/**
 * GuestStarsSection component - displays episode guest stars
 */
export function GuestStarsSection({
  guestStars,
  isLoading,
  maxGuests = 15,
}: GuestStarsSectionProps) {
  const displayGuests = guestStars.slice(0, maxGuests);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guest Stars</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.scrollContent}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (displayGuests.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Guest Stars</Text>
      <ScrollableRow>
        {displayGuests.map((guest, index) => (
          <PersonCard
            key={`guest-${guest.id}-${index}`}
            name={guest.name}
            subtitle={guest.character ?? ''}
            profilePath={guest.profilePath}
          />
        ))}
      </ScrollableRow>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
  },
  subsection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  scrollContainer: {
    position: 'relative',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 8,
  },
  personCard: {
    width: 128,
    flexShrink: 0,
  },
  personPhoto: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#27272a',
    marginBottom: 8,
  },
  personImage: {
    width: '100%',
    height: '100%',
  },
  personPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - web-only
    backgroundImage: 'linear-gradient(to bottom right, #3f3f46, #27272a)',
  },
  personInitial: {
    fontSize: 32,
    fontWeight: '500',
    color: '#71717a',
  },
  personName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  personSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  scrollButton: {
    position: 'absolute',
    top: '50%',
    // @ts-ignore - web-only
    transform: [{ translateY: -20 }],
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollButtonLeft: {
    left: 8,
  },
  scrollButtonRight: {
    right: 8,
  },
  skeleton: {
    backgroundColor: '#27272a',
  },
  skeletonText: {
    height: 14,
    backgroundColor: '#27272a',
    borderRadius: 4,
  },
});

export default CastSection;

