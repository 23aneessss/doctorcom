import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusConfig } from '../../utils/colors';

interface StatusBadgeProps {
  status: keyof typeof statusConfig;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          paddingVertical: size === 'sm' ? 4 : 6,
          paddingHorizontal: size === 'sm' ? 10 : 14,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: size === 'sm' ? 11 : 12,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
