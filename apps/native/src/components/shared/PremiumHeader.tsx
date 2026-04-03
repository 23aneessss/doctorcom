import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface PremiumHeaderProps {
  title: string;
  subtitle?: string;
  backButton?: boolean;
  onBack?: () => void;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  children?: React.ReactNode;
}

export function PremiumHeader({
  title,
  subtitle,
  backButton = true,
  onBack,
  rightAction,
  children,
}: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#0F3460', '#123865', '#285487']}
      locations={[0.3, 0.65, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.headerTop}>
        <View style={styles.leftSide}>
          {backButton ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.textBlock}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {rightAction ? (
          <TouchableOpacity style={styles.actionButton} onPress={rightAction.onPress} activeOpacity={0.8}>
            <Ionicons name={rightAction.icon} size={22} color="#0F3460" />
          </TouchableOpacity>
        ) : null}
      </View>

      {children ? <View style={styles.headerContent}>{children}</View> : null}

      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.05)']}
        style={styles.bottomFade}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 12,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
    paddingRight: 4,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginLeft: 16,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 29,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 6,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: '94%',
  },
  headerContent: {
    marginTop: 20,
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
