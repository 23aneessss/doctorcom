import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button, Input, LoadingOverlay } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { DoctorcomLogo } from '../components/branding/DoctorcomLogo';
import { authClient } from '@/lib/auth-client';
import { trpc } from '../api/trpc';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('admin');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const login = useAuthStore((state) => state.login);
  const utils = trpc.useUtils();
  const mobileProfile = trpc.auth.getMobileProfile.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      const profile = await mobileProfile.refetch();
      if (profile.data) {
        await login(profile.data, null);
      }

      await utils.invalidate();
      router.replace('/today');
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Email ou mot de passe incorrect';
      Alert.alert('Erreur', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isSubmitting} message="Connexion..." />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={['#0F3460', '#123865', '#285487']}
            locations={[0.3, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 18 }]}
          >
            {/* <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>Connexion securisee</Text>
            </View> */}

            <View style={styles.heroBrand}>
              <DoctorcomLogo width={230} height={110} />
              <Text style={styles.heroTitle}>Espace medecin premium</Text>
            </View>
            {/* <Text style={styles.heroSubtitle}>
              Retrouvez votre agenda, vos notes et vos outils dans une interface claire et rapide.
            </Text> */}

            {/* <View style={styles.heroInfoRow}>
              <View style={styles.heroInfoCard}>
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroInfoText}>Agenda quotidien</Text>
              </View>
              <View style={styles.heroInfoCard}>
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroInfoText}>Memoire clinique</Text>
              </View>
            </View> */}

            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.06)']}
              style={styles.bottomFade}
            />
          </LinearGradient>

          <View style={styles.formWrap}>
            <View style={styles.formCard}>
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.title}>Bienvenue</Text>
                  <Text style={styles.subtitle}>Connectez-vous pour acceder a votre espace professionnel</Text>
                </View>
              </View>

              {/* <View style={styles.demoCard}>
                <View style={styles.demoIconWrap}>
                  <Ionicons name="flash-outline" size={18} color="#0F3460" />
                </View>
                <View style={styles.demoCopy}>
                  <Text style={styles.demoTitle}>Acces demo</Text>
                  <Text style={styles.demoText}>admin@admin.com / admin</Text>
                </View>
              </View> */}

              <View style={styles.form}>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="admin@admin.com"
                  label="Adresse email"
                  keyboardType="email-address"
                  autoComplete="email"
                  icon="mail-outline"
                  error={errors.email}
                />

                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mot de passe"
                  label="Mot de passe"
                  secureTextEntry
                  autoComplete="password"
                  icon="lock-closed-outline"
                  error={errors.password}
                />

                <TouchableOpacity
                  style={styles.forgotPassword}
                  activeOpacity={0.75}
                  onPress={() => router.push('/forgot-password' as never)}
                >
                  <Text style={styles.forgotPasswordText}>Mot de passe oublie ?</Text>
                </TouchableOpacity>

                <Button
                  title="Se connecter"
                  onPress={handleLogin}
                  loading={isSubmitting}
                  fullWidth
                  size="lg"
                  style={styles.submitButton}
                />
              </View>

              {/* <View style={styles.securityRow}>
                <View style={styles.securityItem}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#0F3460" />
                  <Text style={styles.securityText}>Session chiffree</Text>
                </View>
                <View style={styles.securityItem}>
                  <Ionicons name="time-outline" size={16} color="#0F3460" />
                  <Text style={styles.securityText}>Acces instantane</Text>
                </View>
              </View> */}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 24,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.2,
  },
  heroBrand: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  heroInfoRow: {
    flexDirection: 'row',
    marginTop: 22,
  },
  heroInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginRight: 10,
  },
  heroInfoText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
  formWrap: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
    maxWidth: 250,
  },
  stepBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F3460',
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 22,
  },
  demoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  demoCopy: {
    flex: 1,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F3460',
    marginBottom: 2,
  },
  demoText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  form: {
    marginTop: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 22,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '700',
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  securityText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F3460',
  },
});
