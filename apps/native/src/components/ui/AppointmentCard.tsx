import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { colors, statusConfig, slotTypeConfig } from '../../utils/colors';
import { formatTime } from '../../utils/dates';

interface AppointmentCardProps {
  id: string;
  startTime: string;
  endTime: string;
  status: keyof typeof statusConfig;
  slotType: keyof typeof slotTypeConfig;
  patientInitials?: string;
  patientLabel?: string;
  onPress?: () => void;
  compact?: boolean;
}

export function AppointmentCard({
  startTime,
  endTime,
  status,
  slotType,
  patientInitials,
  patientLabel,
  onPress,
  compact = false,
}: AppointmentCardProps) {
  const typeConfig = slotTypeConfig[slotType] || slotTypeConfig.consultation;

  const content = (
    <View
      style={[
        styles.container,
        compact && styles.compactContainer,
        { borderLeftColor: typeConfig.color },
      ]}
    >
      <View style={styles.leftSection}>
        {patientInitials && (
          <Avatar initials={patientInitials} size={compact ? 'sm' : 'md'} />
        )}
        <View style={styles.info}>
          <Text style={[styles.name, compact && styles.compactName]} numberOfLines={1}>
            {patientLabel || typeConfig.label}
          </Text>
          <Text style={styles.type}>{typeConfig.label}</Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.time}>{formatTime(startTime)}</Text>
        <StatusBadge status={status} size={compact ? 'sm' : 'md'} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // Premium rounded corners
    padding: 20, // Generous padding
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0', // Subtle crisp border
    shadowColor: '#0F3460', // Very soft blue-tinted shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  compactContainer: {
    padding: 16,
    marginBottom: 8,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  info: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  compactName: {
    fontSize: 15,
  },
  type: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  time: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F3460',
    marginBottom: 8,
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
