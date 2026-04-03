import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, LoadingOverlay } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';
import { trpc } from '../api/trpc';

export default function SecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const changePasswordMutation = trpc.auth.changePassword.useMutation();
  const isSubmitting = changePasswordMutation.isPending;

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Tous les champs sont requis');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'La confirmation ne correspond pas');
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      Alert.alert('Succes', 'Votre mot de passe a ete mis a jour');
      router.back();
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Le mot de passe n a pas pu etre mis a jour';
      Alert.alert('Erreur', message);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isSubmitting} message="Mise a jour..." />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title="Securite"
          subtitle="Gerez votre mot de passe et la protection de votre compte"
          onBack={() => router.back()}
        />

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Changer le mot de passe</Text>

            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              label="Mot de passe actuel"
              placeholder="Votre mot de passe actuel"
              secureTextEntry
              icon="lock-closed-outline"
            />

            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              label="Nouveau mot de passe"
              placeholder="Au moins 6 caracteres"
              secureTextEntry
              icon="shield-checkmark-outline"
            />

            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              label="Confirmation"
              placeholder="Retapez le nouveau mot de passe"
              secureTextEntry
              icon="checkmark-circle-outline"
            />
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Conseil securite</Text>
            <Text style={styles.tipText}>
              Utilisez un mot de passe unique avec lettres, chiffres et caracteres speciaux.
            </Text>
          </View>

          <Button title="Mettre a jour" onPress={handleSave} fullWidth size="lg" style={styles.saveButton} />
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
  tipCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 18,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F3460',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  saveButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
  },
});
