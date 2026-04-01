import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { WelcomeBanner } from '../components/shared/WelcomeBanner';
import { StatCard, AppointmentCard, Card, LoadingSpinner, Avatar } from '../components/ui';
import { colors, statusConfig, slotTypeConfig } from '../utils/colors';
import { getDateString, formatTime, getRelativeTime, formatDurationMinutes } from '../utils/dates';
import { trpc } from '../api/trpc';
import { useAuthStore } from '../stores/authStore';

const { width } = Dimensions.get('window');

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();
  const today = getDateString();

  const { data: summary, isLoading, refetch } = trpc.mobile.today.getSummary.useQuery(
    { date: today },
    { enabled: isAuthenticated }
  );
  const { data: quickStats } = trpc.mobile.today.getQuickStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={refetch} 
            tintColor={colors.white}
            colors={[colors.primary[800]]} // for Android
            progressBackgroundColor={colors.white}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Banner */}
        <WelcomeBanner>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActionsContent}
          >
            <TouchableOpacity
              style={[styles.quickActionTab, styles.quickActionTabActive]}
              onPress={() => router.push({ pathname: '/appointments/new', params: { date: today } })}
            >
              <Ionicons name="add" size={20} color="#0F3460" />
              <Text style={[styles.quickActionText, styles.quickActionTextActive]}>Rendez-vous</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionTab} onPress={() => router.push('/flow' as never)}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Flow Session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTab}
              onPress={() => router.push('/memory?create=1' as never)}
            >
              <Ionicons name="document-text" size={20} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Nouvelle Note</Text>
            </TouchableOpacity>
          </ScrollView>
        </WelcomeBanner>

        <View style={styles.content}>

          <View style={styles.statsList}>
            <View style={styles.statListItem}>
              <StatCard
                title="Rendez-vous"
                value={summary?.totalAppointments || 0}
                icon="calendar-outline"
                iconColor="#0F3460"
                iconBgColor="#F0F4F8"
              />
            </View>
            <View style={styles.statListItem}>
              <StatCard
                title="Patients"
                value={quickStats?.totalNotes || 0}
                icon="people-outline"
                iconColor="#0F3460"
                iconBgColor="#F0F4F8"
              />
            </View>
            <View style={styles.statListItem}>
              <StatCard
                title="Terminés"
                value={summary?.completedAppointments || 0}
                icon="checkmark-circle-outline"
                iconColor="#059669"
                iconBgColor="#ECFDF5"
              />
            </View>
            <View style={styles.statListItem}>
              <StatCard
                title="Annulés"
                value={summary?.cancelledAppointments || 0}
                icon="close-circle-outline"
                iconColor="#E11D48"
                iconBgColor="#FEF2F2"
              />
            </View>
          </View>

          {/* Next Appointment */}
          {summary?.nextAppointment && (
            <Card style={styles.nextAppointmentCard}>
              <View style={styles.nextAppointmentHeader}>
                <View style={styles.nextAppointmentIcon}>
                  <Ionicons name="time" size={20} color="#2563EB" />
                </View>
                <Text style={styles.nextAppointmentLabel}>Prochain rendez-vous</Text>
                <Text style={styles.nextAppointmentTime}>
                  {getRelativeTime(new Date(`${today}T${summary.nextAppointment.startTime}`))}
                </Text>
              </View>
              <AppointmentCard
                id={summary.nextAppointment.id}
                startTime={summary.nextAppointment.startTime}
                endTime={summary.nextAppointment.endTime}
                status={summary.nextAppointment.status as keyof typeof statusConfig}
                slotType={summary.nextAppointment.slotType as keyof typeof slotTypeConfig}
                patientInitials={summary.nextAppointment.patientInitials}
                patientLabel={summary.nextAppointment.patientLabel}
                onPress={() => router.push(`/appointments/${summary.nextAppointment?.id}`)}
              />
            </Card>
          )}

          {/* Today's Schedule */}
          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Programme du jour</Text>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => router.push('/agenda' as never)}>
                <Text style={styles.seeAll}>Voir tout</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary[600]} />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <LoadingSpinner />
            ) : summary?.appointments && summary.appointments.length > 0 ? (
              <View style={styles.appointmentsList}>
                {summary.appointments.slice(0, 5).map((apt, index) => (
                  <View key={apt.id}>
                    <AppointmentCard
                      id={apt.id}
                      startTime={apt.startTime}
                      endTime={apt.endTime}
                      status={apt.status as keyof typeof statusConfig}
                      slotType={apt.slotType as keyof typeof slotTypeConfig}
                      patientInitials={apt.patientInitials}
                      patientLabel={apt.patientLabel}
                      onPress={() => router.push(`/appointments/${apt.id}`)}
                      compact
                    />
                    {index < summary.appointments.slice(0, 5).length - 1 && (
                      <View style={styles.appointmentDivider} />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="calendar-clear" size={32} color={colors.primary[300]} />
                </View>
                <Text style={styles.emptyTitle}>Journée libre</Text>
                <Text style={styles.emptyText}>Vous n'avez aucun rendez-vous de prévu aujourd'hui.</Text>
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => router.push({ pathname: '/appointments/new', params: { date: today } })}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.emptyActionText}>Nouveau rendez-vous</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9', // A very subtle cool off-white for depth
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: 16,
    zIndex: 10,
  },

  quickActionsScroll: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  quickActionsContent: {
    paddingRight: 24,
    gap: 12,
  },
  quickActionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickActionTabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  quickActionTextActive: {
    color: '#0F3460',
  },
  statsList: {
    marginBottom: 10,
  },
  statListItem: {
    marginBottom: 6,
  },
  nextAppointmentCard: {
    marginBottom: 32,
    padding: 20,
    borderWidth: 0, // Removed border for a cleaner floating look
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  nextAppointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextAppointmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nextAppointmentLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  nextAppointmentTime: {
    fontSize: 14,
    color: '#0F3460', // Using the primary brand blue
    fontWeight: '700',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scheduleSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  seeAll: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
    marginRight: 4,
  },
  appointmentsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  appointmentDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F3460', // Primary brand color
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },

});
