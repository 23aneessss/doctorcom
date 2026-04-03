import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../utils/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
}

export function Card({ children, style, padding = 'md', elevated = false }: CardProps) {
  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return 16;
      case 'md': return 20;
      case 'lg': return 28;
      default: return 20;
    }
  };

  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        { padding: getPadding() },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // Premium modern corners
    borderWidth: 1,
    borderColor: '#E2E8F0', // Subtle clean border
    shadowColor: '#0F3460', // Soft blue-tinted shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
});
