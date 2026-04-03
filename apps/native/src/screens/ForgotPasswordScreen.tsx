import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');

  const handleRequest = () => {
    if (!email.trim()) {
      Alert.alert('Information', 'Entrez votre email pour demander une reinitialisation.');
      return;
    }

    Alert.alert(
      'Demande enregistree',
      'Pour ce MVP, contactez le support avec cet email afin de reinitialiser votre acces.',
      [
        { text: 'Fermer' },
        {
          text: 'Contacter le support',
          onPress: () => Linking.openURL(`mailto:support@doctorcom.app?subject=Reinitialisation%20mot%20de%20passe&body=Bonjour,%20merci%20de%20m%20aider%20a%20reinitialiser%20mon%20mot%20de%20passe%20pour%20${encodeURIComponent(email)}`),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title="Mot de passe"
          subtitle="Recuperez l acces a votre compte medecin"
          onBack={() => router.back()}
        />

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Reinitialisation</Text>
            <Text style={styles.subtitle}>
              Saisissez votre email professionnel. Pour ce MVP, l equipe support vous accompagne manuellement.
            </Text>

            <Input
              value={email}
              onChangeText={setEmail}
              label="Adresse email"
              placeholder="vous@cabinet.fr"
              icon="mail-outline"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Button title="Envoyer la demande" onPress={handleRequest} fullWidth size="lg" style={styles.button} />
          </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#64748B',
    marginBottom: 22,
  },
  button: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
    marginTop: 6,
  },
});
