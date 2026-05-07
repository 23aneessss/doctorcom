import React, { useState, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppointmentCard, LoadingSpinner, EmptyState } from '../components/ui';
import { statusConfig, slotTypeConfig, colors } from '../utils/colors';
import {
  getDateString,
  isToday,
  isSameDay,
} from '../utils/dates';
import { trpc } from '../api/trpc';
import { useAuthStore } from '../stores/authStore';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<'all' | keyof typeof statusConfig>('all');

  const dateTabs = useMemo(() => {
    const dates: Date[] = [];
    const base = new Date(selectedDate);
    base.setDate(base.getDate() - 3);
    for (let i = 0; i < 14; i++) {
      dates.push(new Date(base));
      base.setDate(base.getDate() + 1);
    }
    return dates;
  }, [selectedDate]);

  const queryStart = new Date(selectedDate);
  queryStart.setDate(queryStart.getDate() - 7);
  const queryEnd = new Date(selectedDate);
  queryEnd.setDate(queryEnd.getDate() + 14);

  const { data: slots, isLoading, refetch } = trpc.agenda.getSlots.useQuery({
    startDate: getDateString(queryStart),
    endDate: getDateString(queryEnd),
  }, { enabled: isAuthenticated });

  const selectedDateSlots = useMemo(() => {
    if (!slots) return [];
    return slots.filter(slot => isSameDay(slot.date, selectedDate));
  }, [slots, selectedDate]);

  const filteredSlots = useMemo(() => {
    if (statusFilter === 'all') return selectedDateSlots;
    return selectedDateSlots.filter((slot) => slot.status === statusFilter);
  }, [selectedDateSlots, statusFilter]);

  const openFilterPicker = () => {
    Alert.alert(
      'Filtrer les rendez-vous',
      'Choisissez un statut à afficher',
      [
        { text: 'Tous', onPress: () => setStatusFilter('all') },
        { text: 'Confirmés', onPress: () => setStatusFilter('booked') },
        { text: 'En attente', onPress: () => setStatusFilter('pending') },
        { text: 'Terminés', onPress: () => setStatusFilter('completed') },
        { text: 'Annulés', onPress: () => setStatusFilter('cancelled') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#0F3460', '#123865', '#285487']}
          locations={[0.3, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Agenda</Text>
              <Text style={styles.headerSubtitle}>
                {selectedDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() =>
                router.push({
                  pathname: '/appointments/new',
                  params: { date: getDateString(selectedDate) },
                })
              }
            >
              <Ionicons name="add" size={24} color="#0F3460" />
            </TouchableOpacity>
          </View>

          {/* Date strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateSelector}
            contentContainerStyle={{ paddingRight: 24, paddingBottom: 10 }}
          >
            {dateTabs.map((date, index) => {
              const selected = isSameDay(date, selectedDate);
              const isTodayDate = isToday(date);
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.dateTab,
                    selected && styles.dateTabActive,
                    isTodayDate && !selected && styles.dateTabToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateTabDayName,
                      selected && styles.dateTabDayNameActive,
                      isTodayDate && !selected && { color: 'rgba(255,255,255,0.9)' },
                    ]}
                  >
                    {DAYS[date.getDay()]}
                  </Text>
                  <Text
                    style={[
                      styles.dateTabNumber,
                      selected && styles.dateTabNumberActive,
                      isTodayDate && !selected && { color: '#FFFFFF' },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {isTodayDate && (
                    <View
                      style={[
                        styles.todayIndicator,
                        selected && { backgroundColor: '#0F3460' },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.05)']}
            style={styles.bottomFade}
          />
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionCount}>{filteredSlots.length}</Text>
              <Text style={styles.sectionTitle}>
                {filteredSlots.length === 1 ? 'Rendez-vous' : 'Rendez-vous'}
              </Text>
            </View>
            <TouchableOpacity style={styles.filterButton} onPress={openFilterPicker}>
              <Ionicons name="options-outline" size={18} color="#4B5563" />
              {statusFilter !== 'all' && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <LoadingSpinner />
          ) : filteredSlots.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Journée libre"
              description={
                statusFilter === 'all'
                  ? "Aucun rendez-vous n'est planifié pour cette date."
                  : 'Aucun rendez-vous ne correspond à ce filtre.'
              }
              actionLabel="Planifier un rendez-vous"
              onAction={() =>
                router.push({
                  pathname: '/appointments/new',
                  params: { date: getDateString(selectedDate) },
                })
              }
            />
          ) : (
            <View>
              {filteredSlots.map((slot) => (
                <AppointmentCard
                  key={slot.id}
                  id={slot.id}
                  startTime={slot.startTime}
                  endTime={slot.endTime}
                  status={slot.status as keyof typeof statusConfig}
                  slotType={slot.slotType as keyof typeof slotTypeConfig}
                  patientInitials={slot.patientInitials}
                  patientLabel={slot.patientLabel}
                  important={(slot as any).important ?? false}
                  onPress={() => router.push(`/appointments/${slot.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  addButton: {
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
  dateSelector: {
    flexDirection: 'row',
    marginTop: 4,
  },
  dateTab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateTabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  dateTabToday: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  dateTabDayName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateTabDayNameActive: {
    color: '#64748B',
  },
  dateTabNumber: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateTabNumberActive: {
    color: '#0F3460',
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  content: {
    padding: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  sectionCount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
});
