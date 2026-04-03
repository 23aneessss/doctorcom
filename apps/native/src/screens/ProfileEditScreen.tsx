import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, LoadingOverlay } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';
import { trpc } from '../api/trpc';
import { useAuthStore } from '../stores/authStore';

export default function ProfileEditScreen() {
  const { user, setUser } = useAuthStore();
  const { data: profile } = trpc.auth.getMobileProfile.useQuery();
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || 'Dr.');
  const [specialty, setSpecialty] = useState(user?.specialty || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  React.useEffect(() => {
    if (!profile) {
      return;
    }

    setName(profile.name);
    setTitle(profile.title || 'Dr.');
    setSpecialty(profile.specialty || '');
    setAvatarUrl(profile.avatar_url || '');
  }, [profile]);

  const mutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (nextUser) => {
      setUser(nextUser);
      router.back();
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    mutation.mutate({
      name: name.trim(),
      title: title.trim() || 'Dr.',
      specialty: specialty.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    });
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={mutation.isPending} message="Mise a jour..." />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title="Profil"
          subtitle="Mettez a jour vos informations visibles dans l application"
          onBack={() => router.back()}
        />

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Identite</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nom complet</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Dr. Bouziani" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Titre</Text>
              <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Dr." placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Specialite</Text>
              <TextInput
                value={specialty}
                onChangeText={setSpecialty}
                style={styles.input}
                placeholder="Medecine Generale"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>URL de l avatar</Text>
              <TextInput
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
          </View>

          <Button title="Enregistrer les modifications" onPress={handleSave} fullWidth size="lg" style={styles.saveButton} />
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
  saveButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
  },
});
