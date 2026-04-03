import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, getAvatarColor } from '../../utils/colors';

interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function Avatar({ initials, size = 'md', color }: AvatarProps) {
  const backgroundColor = color || getAvatarColor(initials);

  const getSize = () => {
    switch (size) {
      case 'sm':
        return { width: 32, height: 32, fontSize: 12 };
      case 'md':
        return { width: 44, height: 44, fontSize: 16 };
      case 'lg':
        return { width: 56, height: 56, fontSize: 20 };
      default:
        return { width: 44, height: 44, fontSize: 16 };
    }
  };

  const sizeConfig = getSize();

  return (
    <View
      style={[
        styles.container,
        {
          width: sizeConfig.width,
          height: sizeConfig.height,
          backgroundColor,
          borderRadius: sizeConfig.width / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: sizeConfig.fontSize },
        ]}
      >
        {initials.toUpperCase().slice(0, 2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontWeight: '600',
  },
});
