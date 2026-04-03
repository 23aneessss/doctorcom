import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Vibration,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, LoadingSpinner } from '../components/ui';
import { colors } from '../utils/colors';
import { formatDuration } from '../utils/dates';
import { trpc } from '../api/trpc';
import { useFlowStore } from '../stores/flowStore';
import { useAuthStore } from '../stores/authStore';

type Mood = 'excellent' | 'good' | 'average' | 'poor';

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'excellent', emoji: '😊', label: 'Excellent' },
  { value: 'good', emoji: '🙂', label: 'Bien' },
  { value: 'average', emoji: '😐', label: 'Moyen' },
  { value: 'poor', emoji: '😔', label: 'Difficile' },
];

export default function FlowScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { 
    isActive, 
    sessionId, 
    startedAt, 
    elapsedSeconds, 
    notes,
    startSession,
    endSession,
    updateElapsed,
    updateNotes,
    reset,
  } = useFlowStore();

  const [showEndModal, setShowEndModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [focusScore, setFocusScore] = useState(7);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tRPC mutations
  const startMutation = trpc.mobile.flow.startSession.useMutation({
    onSuccess: (data) => {
      startSession(data.id);
      Vibration.vibrate(100);
    },
    onError: (error) => {
      Alert.alert('Erreur', error.message);
    },
  });

  const endMutation = trpc.mobile.flow.endSession.useMutation({
    onSuccess: () => {
      reset();
      setShowEndModal(false);
      setSelectedMood(null);
      setFocusScore(7);
      Vibration.vibrate([100, 100, 100]);
    },
    onError: (error) => {
      Alert.alert('Erreur', error.message);
    },
  });

  const updateNotesMutation = trpc.mobile.flow.updateNotes.useMutation();

  // Fetch active session on mount
  const { data: activeSession } = trpc.mobile.flow.getActiveSession.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Fetch stats
  const { data: stats } = trpc.mobile.flow.getStats.useQuery(
    { days: 7 },
    { enabled: isAuthenticated }
  );

  // Restore active session if exists
  useEffect(() => {
    if (activeSession && !isActive) {
      startSession(activeSession.id);
      const started = new Date(activeSession.startedAt);
      const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
      updateElapsed(elapsed);
    }
  }, [activeSession]);

  // Timer effect
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        updateElapsed(elapsedSeconds + 1);
      }, 1000);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      pulseAnim.stopAnimation();
    };
  }, [isActive, elapsedSeconds]);

  const handleStart = () => {
    startMutation.mutate();
  };

  const handlePause = () => {
    setShowEndModal(true);
  };

  const handleEndSession = () => {
    if (!sessionId) return;
    
    endMutation.mutate({
      id: sessionId,
      sessionNotes: notes,
      mood: selectedMood || undefined,
      focusScore: focusScore,
    });
  };

  const handleSaveNotes = useCallback(() => {
    if (sessionId && notes) {
      updateNotesMutation.mutate({ id: sessionId, sessionNotes: notes });
    }
  }, [sessionId, notes]);

  // Auto-save notes every 30 seconds
  useEffect(() => {
    if (isActive && notes) {
      const saveTimer = setTimeout(handleSaveNotes, 30000);
      return () => clearTimeout(saveTimer);
    }
  }, [notes, isActive, handleSaveNotes]);

  const formatTimeDisplay = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isActive ? ['#0A2444', '#0F3460', '#1C4066'] : ['#0F3460', '#123865', '#285487']}
        locations={[0.3, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mode Flow</Text>
          <Text style={styles.headerSubtitle}>
            {isActive ? 'Session en cours' : 'Prêt pour une session concentrée'}
          </Text>
        </View>

        {/* Timer Display */}
        <View style={styles.timerSection}>
          <Animated.View 
            style={[
              styles.timerContainer,
              isActive && { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={[
              styles.timerRing,
              isActive && styles.timerRingActive,
            ]}>
              <View style={styles.timerInner}>
                <Text style={styles.timerText}>{formatTimeDisplay(elapsedSeconds)}</Text>
                {isActive && (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>En session</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Control Button */}
        <View style={styles.controlSection}>
          {!isActive ? (
            <TouchableOpacity 
              style={styles.startButton}
              onPress={handleStart}
              disabled={startMutation.isPending}
            >
              <View style={styles.startButtonSolid}>
                {startMutation.isPending ? (
                  <LoadingSpinner color="#0F3460" size="small" />
                ) : (
                  <>
                    <Ionicons name="play" size={32} color="#0F3460" />
                    <Text style={styles.startButtonText}>Démarrer</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.pauseButton}
              onPress={handlePause}
            >
              <Ionicons name="stop" size={28} color={colors.status.cancelled} />
              <Text style={styles.pauseButtonText}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes Section (visible when active) */}
        {isActive && (
          <Card style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.accent.teal} />
              <Text style={styles.notesTitle}>Notes de session</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Prenez des notes rapides..."
              placeholderTextColor={colors.text.tertiary}
              value={notes}
              onChangeText={updateNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Card>
        )}

        {/* Stats Section */}
        {!isActive && stats && (
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Statistiques (7 derniers jours)</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalDurationMinutes} min</Text>
                <Text style={styles.statLabel}>Temps total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.avgFocusScore}</Text>
                <Text style={styles.statLabel}>Score moyen</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tips Section */}
        {!isActive && (
          <Card style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb-outline" size={20} color={colors.accent.orange} />
              <Text style={styles.tipsTitle}>Conseils pour une session productive</Text>
            </View>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.status.completed} />
                <Text style={styles.tipText}>Mettez votre téléphone en mode silencieux</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.status.completed} />
                <Text style={styles.tipText}>Préparez votre espace de travail</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.status.completed} />
                <Text style={styles.tipText}>Prenez des pauses régulières</Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* End Session Modal */}
      {showEndModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Terminer la session</Text>
            <Text style={styles.modalSubtitle}>
              Durée: {formatDuration(elapsedSeconds)}
            </Text>

            {/* Mood Selection */}
            <Text style={styles.modalLabel}>Comment s'est passée cette session ?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((mood) => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodButton,
                    selectedMood === mood.value && styles.moodButtonActive,
                  ]}
                  onPress={() => setSelectedMood(mood.value)}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={[
                    styles.moodLabel,
                    selectedMood === mood.value && styles.moodLabelActive,
                  ]}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Focus Score */}
            <Text style={styles.modalLabel}>Score de concentration: {focusScore}/10</Text>
            <View style={styles.scoreSlider}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.scoreButton,
                    focusScore === score && styles.scoreButtonActive,
                  ]}
                  onPress={() => setFocusScore(score)}
                >
                  <Text style={[
                    styles.scoreText,
                    focusScore === score && styles.scoreTextActive,
                  ]}>
                    {score}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEndModal(false)}
              >
                <Text style={styles.modalCancelText}>Continuer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleEndSession}
                disabled={endMutation.isPending}
              >
                {endMutation.isPending ? (
                  <LoadingSpinner color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Terminer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.primary[200],
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerContainer: {
    // Animation container
  },
  timerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRingActive: {
    borderColor: colors.accent.teal,
    borderWidth: 6,
    shadowColor: colors.accent.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  timerInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.cancelled,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 12,
    color: colors.primary[200],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  controlSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  startButton: {
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  startButtonSolid: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F3460',
    marginLeft: 12,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.status.cancelled,
  },
  pauseButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.status.cancelled,
    marginLeft: 8,
  },
  notesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 8,
  },
  notesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: colors.white,
    fontSize: 15,
    minHeight: 100,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  statLabel: {
    fontSize: 12,
    color: colors.primary[200],
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
  },
  tipsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 8,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 14,
    color: colors.primary[200],
    marginLeft: 10,
  },
  // Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  moodButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    flex: 1,
    marginHorizontal: 4,
  },
  moodButtonActive: {
    backgroundColor: colors.primary[100],
    borderWidth: 2,
    borderColor: colors.primary[800],
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  moodLabelActive: {
    color: colors.primary[800],
    fontWeight: '600',
  },
  scoreSlider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  scoreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreButtonActive: {
    backgroundColor: colors.primary[800],
  },
  scoreText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  scoreTextActive: {
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary[800],
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
