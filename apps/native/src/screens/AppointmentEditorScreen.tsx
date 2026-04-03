import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, LoadingOverlay, LoadingSpinner } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';
import { colors, slotTypeConfig, statusConfig } from '../utils/colors';
import { trpc } from '../api/trpc';
import { getDateString } from '../utils/dates';

const SLOT_TYPES = Object.keys(slotTypeConfig) as Array<keyof typeof slotTypeConfig>;
const SLOT_STATUSES = ['booked', 'pending', 'completed', 'cancelled', 'blocked'] as const;

const getDefaultTimeWindow = () => {
  const now = new Date();
  const roundedMinutes = now.getMinutes() < 30 ? 30 : 0;
  const hours = roundedMinutes === 0 ? now.getHours() + 1 : now.getHours();
  const start = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
  const endDate = new Date();
  endDate.setHours(hours, roundedMinutes + 30, 0, 0);
  const end = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  return { start, end };
};

export default function AppointmentEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const utils = trpc.useUtils();
  const isEditing = Boolean(params.id);
  const defaults = useMemo(() => getDefaultTimeWindow(), []);

  const [date, setDate] = useState(params.date || getDateString());
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [patientLabel, setPatientLabel] = useState('');
  const [patientInitials, setPatientInitials] = useState('');
  const [notes, setNotes] = useState('');
  const [slotType, setSlotType] = useState<keyof typeof slotTypeConfig>('consultation');
  const [status, setStatus] = useState<(typeof SLOT_STATUSES)[number]>('booked');

  const { data: slot, isLoading } = trpc.agenda.getSlot.useQuery(
    { id: params.id! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (!slot) {
      return;
    }

    setDate(slot.date.slice(0, 10));
    setStartTime(slot.startTime.slice(0, 5));
    setEndTime(slot.endTime.slice(0, 5));
    setPatientLabel(slot.patientLabel || '');
    setPatientInitials(slot.patientInitials || '');
    setNotes(slot.notes || '');
    setSlotType(slot.slotType as keyof typeof slotTypeConfig);
    setStatus(slot.status as (typeof SLOT_STATUSES)[number]);
  }, [slot]);

  const invalidateQueries = async () => {
    await Promise.all([
      utils.agenda.getSlots.invalidate(),
      utils.agenda.getDaySlots.invalidate(),
      utils.mobile.today.getSummary.invalidate(),
      utils.mobile.today.getQuickStats.invalidate(),
    ]);
  };

  const createMutation = trpc.agenda.createSlot.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
      router.replace('/agenda');
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const updateMutation = trpc.agenda.updateSlot.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
      router.back();
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const deleteMutation = trpc.agenda.deleteSlot.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
      router.replace('/agenda');
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Erreur', 'La date doit etre au format YYYY-MM-DD');
      return false;
    }

    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert('Erreur', 'Les heures doivent etre au format HH:MM');
      return false;
    }

    if (endTime <= startTime) {
      Alert.alert('Erreur', 'L heure de fin doit etre apres l heure de debut');
      return false;
    }

    if (!patientLabel.trim() && status !== 'blocked') {
      Alert.alert('Erreur', 'Ajoutez un libelle patient ou un motif de rendez-vous');
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const payload = {
      date,
      startTime,
      endTime,
      status,
      slotType,
      patientInitials: patientInitials.trim() || undefined,
      patientLabel: patientLabel.trim() || undefined,
      notes: notes.trim() || undefined,
      color: slotTypeConfig[slotType].color,
    };

    if (isEditing) {
      updateMutation.mutate({ id: params.id!, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (!params.id) {
      return;
    }

    Alert.alert(
      'Supprimer le rendez-vous',
      'Cette action est irreversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: params.id! }),
        },
      ]
    );
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isMutating} message={isEditing ? 'Mise a jour...' : 'Creation...'} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title={isEditing ? 'Rendez-vous' : 'Nouveau rendez-vous'}
          subtitle={isEditing ? 'Modifiez les details de ce creneau' : 'Ajoutez un creneau a votre agenda'}
          onBack={() => router.back()}
          rightAction={isEditing ? { icon: 'trash-outline', onPress: handleDelete } : undefined}
        />

        <View style={styles.content}>
          {isEditing && isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Informations du rendez-vous</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="2026-03-27"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>Debut</Text>
                    <TextInput
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="09:00"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>Fin</Text>
                    <TextInput
                      value={endTime}
                      onChangeText={setEndTime}
                      placeholder="09:30"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nom visible</Text>
                  <TextInput
                    value={patientLabel}
                    onChangeText={setPatientLabel}
                    placeholder="Consultation de routine"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Initiales patient</Text>
                  <TextInput
                    value={patientInitials}
                    onChangeText={(text) => setPatientInitials(text.toUpperCase().slice(0, 5))}
                    placeholder="DB"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Informations utiles pour ce creneau"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.notesInput]}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Type de rendez-vous</Text>
                <View style={styles.chipGrid}>
                  {SLOT_TYPES.map((item) => {
                    const active = slotType === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.chip,
                          active && { backgroundColor: `${slotTypeConfig[item].color}18`, borderColor: slotTypeConfig[item].color },
                        ]}
                        onPress={() => setSlotType(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && { color: slotTypeConfig[item].color }]}>
                          {slotTypeConfig[item].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Statut</Text>
                <View style={styles.chipGrid}>
                  {SLOT_STATUSES.map((item) => {
                    const active = status === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.chip,
                          active && { backgroundColor: statusConfig[item].bgColor, borderColor: statusConfig[item].color },
                        ]}
                        onPress={() => setStatus(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && { color: statusConfig[item].textColor }]}>
                          {statusConfig[item].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Button
                title={isEditing ? 'Enregistrer les modifications' : 'Creer le rendez-vous'}
                onPress={handleSave}
                fullWidth
                size="lg"
                style={styles.saveButton}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  notesInput: {
    minHeight: 112,
    paddingTop: 14,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
    marginTop: 4,
  },
});
