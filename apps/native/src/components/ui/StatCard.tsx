import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  onPress?: () => void;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  icon,
  iconColor = colors.primary[800],
  iconBgColor = colors.primary[100],
  onPress,
  trend,
}: StatCardProps) {
  const content = (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.copySection}>
          <Text style={styles.title}>{title}</Text>
          {trend && (
            <View
              style={[
                styles.trendContainer,
                { backgroundColor: trend.isPositive ? '#D1FAE5' : '#FEE2E2' },
              ]}
            >
              <Ionicons
                name={trend.isPositive ? 'trending-up' : 'trending-down'}
                size={12}
                color={trend.isPositive ? colors.status.completed : colors.status.cancelled}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trend.isPositive ? colors.status.completed : colors.status.cancelled },
                ]}
              >
                {trend.value}%
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.valueLabel}>today</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  copySection: {
    flex: 1,
    marginLeft: 14,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
