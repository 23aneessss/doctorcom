import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';

interface WelcomeBannerProps {
  showGreeting?: boolean;
  children?: React.ReactNode;
}

export function WelcomeBanner({ showGreeting = true, children }: WelcomeBannerProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDisplayName = () => {
    const fullName = user?.name?.trim() || 'Doctor';
    const knownTitles = ['dr', 'doctor', 'docteur', 'pr', 'prof'];
    const normalizedTitle = user?.title?.replace(/\./g, '').toLowerCase();
    const nameParts = fullName.split(' ').filter(Boolean);

    while (nameParts.length > 0) {
      const normalizedPart = nameParts[0].replace(/\./g, '').toLowerCase();
      if (normalizedPart === normalizedTitle || knownTitles.includes(normalizedPart)) {
        nameParts.shift();
      } else {
        break;
      }
    }

    const firstName = nameParts[0];

    if (user?.title && firstName) {
      return `${user.title} ${firstName}`;
    }

    if (firstName) {
      return firstName;
    }

    return user?.title || fullName;
  };

  return (
    <LinearGradient
      colors={['#0F3460', '#123865', '#285487']}
      locations={[0.3, 0.65, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 4 }]}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.logoContainer}>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
          
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
          </View>
        </View>

        {showGreeting && user && (
          <View style={styles.headerTitleRow}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.name}>{getDisplayName()}</Text>
            </View>
          </View>
        )}

        {children ? <View style={styles.actionSlot}>{children}</View> : null}
      </View>
      
      {/* Soft gradient fade at the bottom to transition beautifully */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.05)']}
        style={styles.bottomFade}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  content: {
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 0,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 0,
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  actionSlot: {
    marginTop: 16,
  },

  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
});
