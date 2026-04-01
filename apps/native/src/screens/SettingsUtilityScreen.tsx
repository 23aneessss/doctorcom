import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';

type SettingsUtilityMode =
  | 'appearance'
  | 'notifications'
  | 'workHours'
  | 'sync'
  | 'help'
  | 'contact'
  | 'terms'
  | 'privacy';

interface SettingsUtilityScreenProps {
  mode: SettingsUtilityMode;
}

const STORAGE_KEYS = {
  notifications: 'doctorcom_notifications',
  appearance: 'doctorcom_appearance',
  workHours: 'doctorcom_work_hours',
  sync: 'doctorcom_sync',
} as const;

const DEFAULT_APPEARANCE = {
  theme: 'light',
  compactCards: false,
};

const DEFAULT_NOTIFICATIONS = {
  appointmentReminders: true,
  flowRecaps: true,
  weeklyDigest: false,
};

const DEFAULT_WORK_HOURS = {
  days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
  startTime: '08:30',
  endTime: '18:00',
};

const DEFAULT_SYNC = {
  autoSync: true,
  wifiOnly: false,
  lastSyncAt: '',
};

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function SettingsUtilityScreen({ mode }: SettingsUtilityScreenProps) {
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [workHours, setWorkHours] = useState(DEFAULT_WORK_HOURS);
  const [sync, setSync] = useState(DEFAULT_SYNC);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (mode === 'appearance') {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.appearance);
        if (stored) setAppearance(JSON.parse(stored));
      }

      if (mode === 'notifications') {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.notifications);
        if (stored) setNotifications(JSON.parse(stored));
      }

      if (mode === 'workHours') {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.workHours);
        if (stored) setWorkHours(JSON.parse(stored));
      }

      if (mode === 'sync') {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.sync);
        if (stored) setSync(JSON.parse(stored));
      }
    };

    load();
  }, [mode]);

  const config = useMemo(() => {
    switch (mode) {
      case 'appearance':
        return {
          title: 'Apparence',
          subtitle: 'Gardez une interface claire et coherente avec le design actuel',
        };
      case 'notifications':
        return {
          title: 'Notifications',
          subtitle: 'Controlez les alertes importantes de votre journee',
        };
      case 'workHours':
        return {
          title: 'Horaires de travail',
          subtitle: 'Definissez votre rythme hebdomadaire et votre plage de disponibilite',
        };
      case 'sync':
        return {
          title: 'Synchronisation',
          subtitle: 'Pilotez le comportement de synchro de votre application',
        };
      case 'help':
        return {
          title: 'Aide',
          subtitle: 'Retrouvez les reponses aux questions frequentes',
        };
      case 'contact':
        return {
          title: 'Nous contacter',
          subtitle: 'Le support vous aide a finaliser votre usage du MVP',
        };
      case 'terms':
        return {
          title: 'Conditions',
          subtitle: 'Cadre d utilisation de DoctorCom Mobile',
        };
      case 'privacy':
        return {
          title: 'Confidentialite',
          subtitle: 'Resume de la gestion des donnees et de la vie privee',
        };
      default:
        return { title: 'Parametre', subtitle: '' };
    }
  }, [mode]);

  const persist = async () => {
    setIsSaving(true);

    try {
      if (mode === 'appearance') {
        await AsyncStorage.setItem(STORAGE_KEYS.appearance, JSON.stringify(appearance));
      }

      if (mode === 'notifications') {
        await AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
      }

      if (mode === 'workHours') {
        await AsyncStorage.setItem(STORAGE_KEYS.workHours, JSON.stringify(workHours));
      }

      if (mode === 'sync') {
        const nextValue = { ...sync, lastSyncAt: new Date().toISOString() };
        setSync(nextValue);
        await AsyncStorage.setItem(STORAGE_KEYS.sync, JSON.stringify(nextValue));
      }

      Alert.alert('Succes', 'Vos preferences ont ete enregistrees');
    } catch {
      Alert.alert('Erreur', 'Impossible d enregistrer ces preferences pour le moment');
    } finally {
      setIsSaving(false);
    }
  };

  const renderAppearance = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <TouchableOpacity
          style={[styles.optionCard, appearance.theme === 'light' && styles.optionCardActive]}
          onPress={() => setAppearance((prev) => ({ ...prev, theme: 'light' }))}
        >
          <View>
            <Text style={styles.optionTitle}>Clair premium</Text>
            <Text style={styles.optionDescription}>Le style actuel, lumineux et aligne avec le dashboard mobile.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={appearance.theme === 'light' ? '#0F3460' : '#CBD5E1'} />
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <SettingToggle
          icon="albums-outline"
          title="Cartes compactes"
          description="Reduire legerement la densite des cartes secondaires"
          value={appearance.compactCards}
          onValueChange={(value) => setAppearance((prev) => ({ ...prev, compactCards: value }))}
          isLast
        />
      </View>
    </>
  );

  const renderNotifications = () => (
    <View style={styles.card}>
      <SettingToggle
        icon="notifications-outline"
        title="Rappels de rendez-vous"
        description="Recevoir un rappel avant les rendez-vous importants"
        value={notifications.appointmentReminders}
        onValueChange={(value) => setNotifications((prev) => ({ ...prev, appointmentReminders: value }))}
      />
      <SettingToggle
        icon="pulse-outline"
        title="Recaps de flow"
        description="Etre notifie apres chaque session Flow"
        value={notifications.flowRecaps}
        onValueChange={(value) => setNotifications((prev) => ({ ...prev, flowRecaps: value }))}
      />
      <SettingToggle
        icon="bar-chart-outline"
        title="Resume hebdomadaire"
        description="Recevoir un bilan de vos activites chaque semaine"
        value={notifications.weeklyDigest}
        onValueChange={(value) => setNotifications((prev) => ({ ...prev, weeklyDigest: value }))}
        isLast
      />
    </View>
  );

  const renderWorkHours = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Jours actifs</Text>
        <View style={styles.chipWrap}>
          {WEEK_DAYS.map((day) => {
            const active = workHours.days.includes(day);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() =>
                  setWorkHours((prev) => ({
                    ...prev,
                    days: active ? prev.days.filter((item) => item !== day) : [...prev.days, day],
                  }))
                }
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plage horaire</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Debut</Text>
            <TextInput
              value={workHours.startTime}
              onChangeText={(value) => setWorkHours((prev) => ({ ...prev, startTime: value }))}
              style={styles.input}
              placeholder="08:30"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Fin</Text>
            <TextInput
              value={workHours.endTime}
              onChangeText={(value) => setWorkHours((prev) => ({ ...prev, endTime: value }))}
              style={styles.input}
              placeholder="18:00"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>
      </View>
    </>
  );

  const renderSync = () => (
    <>
      <View style={styles.card}>
        <SettingToggle
          icon="sync-outline"
          title="Synchronisation automatique"
          description="Maintenir vos donnees a jour en continu"
          value={sync.autoSync}
          onValueChange={(value) => setSync((prev) => ({ ...prev, autoSync: value }))}
        />
        <SettingToggle
          icon="wifi-outline"
          title="Wi-Fi seulement"
          description="Eviter la synchro sur reseau cellulaire"
          value={sync.wifiOnly}
          onValueChange={(value) => setSync((prev) => ({ ...prev, wifiOnly: value }))}
          isLast
        />
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Derniere synchronisation</Text>
        <Text style={styles.infoText}>{sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString('fr-FR') : 'Aucune synchro manuelle recente'}</Text>
      </View>
    </>
  );

  const renderHelp = () => (
    <View style={styles.card}>
      {[
        ['Comment planifier un rendez-vous ?', 'Utilisez le bouton + dans Agenda ou la quick action Rendez-vous depuis Home.'],
        ['Comment enregistrer une idee rapide ?', 'Ouvrez Memory puis creez une note ou lancez une session Flow pour capturer vos notes.'],
        ['Mes donnees restent-elles synchronisees ?', 'Oui, si la synchronisation automatique est activee dans les parametres.'],
      ].map(([title, description], index, array) => (
        <View key={title} style={[styles.faqItem, index < array.length - 1 && styles.faqBorder]}>
          <Text style={styles.faqTitle}>{title}</Text>
          <Text style={styles.faqText}>{description}</Text>
        </View>
      ))}
    </View>
  );

  const renderContact = () => (
    <>
      <View style={styles.card}>
        <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@doctorcom.app')}>
          <Ionicons name="mail-outline" size={20} color="#0F3460" />
          <View style={styles.contactCopy}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactValue}>support@doctorcom.app</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.contactDivider} />
        <View style={styles.contactRow}>
          <Ionicons name="time-outline" size={20} color="#0F3460" />
          <View style={styles.contactCopy}>
            <Text style={styles.contactLabel}>Delai de reponse</Text>
            <Text style={styles.contactValue}>Sous 24h a 48h ouvrées</Text>
          </View>
        </View>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Partagez une capture, votre appareil et le comportement observe pour accelerer la resolution.</Text>
      </View>
    </>
  );

  const renderLegal = () => (
    <View style={styles.card}>
      <Text style={styles.legalParagraph}>
        {mode === 'terms'
          ? 'DoctorCom Mobile est concu pour l organisation du travail medical, la planification, les notes non sensibles et les sessions Flow. L utilisateur reste responsable de la conformite de son usage et des donnees saisies.'
          : 'DoctorCom Mobile vise a limiter les donnees sensibles. Les informations affichees dans ce MVP concernent votre organisation, vos notes personnelles et vos elements de session. Vous gardez le controle de vos donnees et de votre acces.'}
      </Text>
      <Text style={styles.legalParagraph}>
        {mode === 'terms'
          ? 'Ce MVP est en amelioration continue. Certaines fonctionnalites peuvent evoluer rapidement pour mieux soutenir votre pratique quotidienne.'
          : 'Pour ce MVP, la confidentialite est renforcee par des donnees minimales, une authentification de session et un design centre sur les besoins medicaux essentiels.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader title={config.title} subtitle={config.subtitle} onBack={() => router.back()} />

        <View style={styles.content}>
          {mode === 'appearance' && renderAppearance()}
          {mode === 'notifications' && renderNotifications()}
          {mode === 'workHours' && renderWorkHours()}
          {mode === 'sync' && renderSync()}
          {mode === 'help' && renderHelp()}
          {mode === 'contact' && renderContact()}
          {(mode === 'terms' || mode === 'privacy') && renderLegal()}

          {(mode === 'appearance' || mode === 'notifications' || mode === 'workHours' || mode === 'sync') && (
            <Button title={mode === 'sync' ? 'Enregistrer et synchroniser' : 'Enregistrer'} onPress={persist} fullWidth size="lg" style={styles.saveButton} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SettingToggle({
  icon,
  title,
  description,
  value,
  onValueChange,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !isLast && styles.toggleBorder]}>
      <View style={styles.toggleIconWrap}>
        <Ionicons name={icon} size={18} color="#0F3460" />
      </View>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#CBD5E1', true: '#93C5FD' }} thumbColor={value ? '#0F3460' : '#FFFFFF'} />
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
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 18,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F3460',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  optionCardActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#EFF6FF',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  optionDescription: {
    maxWidth: 250,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    marginBottom: 8,
  },
  dayChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA',
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  dayChipTextActive: {
    color: '#0F3460',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  toggleBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  toggleCopy: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
  faqItem: {
    paddingVertical: 14,
  },
  faqBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  faqText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contactCopy: {
    marginLeft: 12,
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: '#64748B',
  },
  contactDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  legalParagraph: {
    fontSize: 14,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 14,
  },
  saveButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
  },
});
