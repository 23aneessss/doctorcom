import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { statusConfig, slotTypeConfig } from '../../utils/colors';
import { formatTime } from '../../utils/dates';

interface AppointmentCardProps {
  id: string;
  startTime: string;
  endTime: string;
  status: keyof typeof statusConfig;
  slotType: keyof typeof slotTypeConfig;
  patientInitials?: string;
  patientLabel?: string;
  important?: boolean;
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
  important = false,
  onPress,
  compact = false,
}: AppointmentCardProps) {
  const typeConfig = slotTypeConfig[slotType] || slotTypeConfig.consultation;

  const content = compact ? (
    // Compact layout for TodayScreen: horizontal row
    <View style={[styles.compactContainer, { borderLeftColor: typeConfig.color }]}>
      {patientInitials && <Avatar initials={patientInitials} size="sm" />}
      <View style={styles.compactInfo}>
        <Text style={styles.compactName} numberOfLines={1}>
          {patientLabel || typeConfig.label}
        </Text>
        <Text style={styles.compactType}>{typeConfig.label}</Text>
      </View>
      <View style={styles.compactRight}>
        <Text style={styles.compactTime}>{formatTime(startTime)}</Text>
        <StatusBadge status={status} size="sm" />
      </View>
    </View>
  ) : (
    // Full layout for AgendaScreen: time on top, patient below
    <View style={[styles.container, { borderLeftColor: typeConfig.color }]}>
      {/* Top row: time range + status + important */}
      <View style={styles.topRow}>
        <View style={styles.timeChip}>
          <Ionicons name="time-outline" size={13} color="#4B6584" style={styles.timeIcon} />
          <Text style={styles.timeRange}>
            {formatTime(startTime)} – {formatTime(endTime)}
          </Text>
        </View>
        <View style={styles.topRight}>
          {important && (
            <View style={styles.importantDot} />
          )}
          <StatusBadge status={status} size="md" />
        </View>
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Bottom row: avatar + patient info */}
      <View style={styles.patientRow}>
        {patientInitials ? (
          <Avatar initials={patientInitials} size="md" />
        ) : (
          <View style={styles.genericAvatar}>
            <Ionicons name="person" size={20} color="#64748B" />
          </View>
        )}
        <View style={styles.patientInfo}>
          <Text style={styles.patientName} numberOfLines={1}>
            {patientLabel || 'Patient'}
          </Text>
          <View style={styles.typeRow}>
            <View style={[styles.typeIndicator, { backgroundColor: typeConfig.color }]} />
            <Text style={styles.typeName}>{typeConfig.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  // Full (agenda) layout
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timeIcon: {
    marginRight: 4,
  },
  timeRange: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genericAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInfo: {
    marginLeft: 14,
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  typeName: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Compact (today) layout
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  compactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  compactType: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  compactRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 6,
  },
  compactTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3460',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
