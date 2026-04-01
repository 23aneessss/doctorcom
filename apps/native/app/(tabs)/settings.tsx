import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { authClient } from '@/lib/auth-client';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
}

function SettingItem({
  icon,
  label,
  description,
  onPress,
  showChevron = true,
  danger = false,
  isLast = false,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? '#E11D48' : '#0F3460'} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>
          {label}
        </Text>
        {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnexion',
          style: 'destructive',
          onPress: async () => {
            await authClient.signOut();
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#0F3460', '#123865', '#285487']}
          locations={[0.3, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Votre compte et vos preferences</Text>
            </View>
            {/* <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={() => router.push('/settings/profile' as never)}
            >
              <Ionicons name="pencil" size={24} color="#0F3460" />
            </TouchableOpacity> */}
          </View>

          <View style={styles.identityCard}>
            <View style={styles.identityTopRow}>
              <View style={styles.avatarWrap}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{user?.name ? getInitials(user.name) : 'DR'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.identityCopy}>
                <Text style={styles.identityEyebrow}>Compte principal</Text>
                <Text style={styles.identityName} numberOfLines={1}>
                  {user?.name || 'Dr. Admin'}
                </Text>
                <Text style={styles.identityRole} numberOfLines={1}>
                  {user?.specialty || 'Medecine Generale'}
                </Text>
              </View>

              <View style={styles.identityStatusBadge}>
                <View style={styles.identityStatusDot} />
                <Text style={styles.identityStatusText}>Actif</Text>
              </View>
            </View>
          </View>

          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.05)']}
            style={styles.bottomFade}
          />
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={18} color="#F97316" />
              <Text style={styles.sectionTitle}>Compte</Text>
              <Text style={styles.sectionCount}>3</Text>
            </View>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="person-outline"
                label="Profil"
                description="Modifier vos informations personnelles"
                onPress={() => router.push('/settings/profile' as never)}
              />
              <SettingItem
                icon="lock-closed-outline"
                label="Securite"
                description="Mot de passe et authentification"
                onPress={() => router.push('/settings/security' as never)}
              />
              <SettingItem
                icon="notifications-outline"
                label="Notifications"
                description="Gerer vos preferences"
                onPress={() => router.push('/settings/notifications' as never)}
                isLast
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={18} color="#64748B" />
              <Text style={styles.sectionTitle}>Application</Text>
              <Text style={styles.sectionCount}>3</Text>
            </View>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="color-palette-outline"
                label="Apparence"
                description="Theme et personnalisation"
                onPress={() => router.push('/settings/appearance' as never)}
              />
              <SettingItem
                icon="time-outline"
                label="Horaires de travail"
                description="Configurer vos disponibilites"
                onPress={() => router.push('/settings/work-hours' as never)}
              />
              <SettingItem
                icon="sync-outline"
                label="Synchronisation"
                description="Parametres de synchronisation"
                onPress={() => router.push('/settings/sync' as never)}
                isLast
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle-outline" size={18} color="#64748B" />
              <Text style={styles.sectionTitle}>Support</Text>
              <Text style={styles.sectionCount}>4</Text>
            </View>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="help-circle-outline"
                label="Aide"
                description="Centre d'aide et FAQ"
                onPress={() => router.push('/settings/help' as never)}
              />
              <SettingItem
                icon="chatbubble-outline"
                label="Nous contacter"
                description="Support technique"
                onPress={() => router.push('/settings/contact' as never)}
              />
              <SettingItem
                icon="document-text-outline"
                label="Conditions d'utilisation"
                onPress={() => router.push('/settings/terms' as never)}
              />
              <SettingItem
                icon="shield-checkmark-outline"
                label="Politique de confidentialite"
                onPress={() => router.push('/settings/privacy' as never)}
                isLast
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={18} color="#E11D48" />
              <Text style={[styles.sectionTitle, styles.dangerTitle]}>Session</Text>
            </View>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="log-out-outline"
                label="Deconnexion"
                description="Fermer la session sur cet appareil"
                onPress={handleLogout}
                showChevron={false}
                danger
                isLast
              />
            </View>
          </View>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>DoctorCom Mobile v1.0.0</Text>
            <Text style={styles.copyrightText}>© 2024 DoctorCom</Text>
          </View>
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
    backgroundColor: '#0F3460',
    paddingHorizontal: 24,
    paddingBottom: 28,
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
    marginBottom: 22,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  // addButton: {
  //   width: 44,
  //   height: 44,
  //   borderRadius: 22,
  //   backgroundColor: '#FFFFFF',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   shadowColor: '#0F3460',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.15,
  //   shadowRadius: 8,
  //   elevation: 4,
  // },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#081B33',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,

  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  avatarWrap: {
    marginRight: 14,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#E6FFFB',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  identityCopy: {
    flex: 1,
  },
  identityEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  identityName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  identityRole: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '700',
    marginTop: 4,
  },
  identityStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  identityStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  identityStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  identityDetailRow: {
    marginBottom: 14,
  },
  identityDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  identityDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    fontWeight: '500',
  },
  identityMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  identityMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  identityMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F3460',
    marginLeft: 6,
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 'auto',
    fontWeight: '600',
  },
  dangerTitle: {
    color: '#E11D48',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: '#FEF2F2',
  },
  settingContent: {
    flex: 1,
    marginLeft: 14,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  settingLabelDanger: {
    color: '#E11D48',
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  versionContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 32,
  },
  versionText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  copyrightText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});
