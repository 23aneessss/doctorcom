import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/authStore';
import { colors } from '../src/utils/colors';
import { ONBOARDING_COMPLETE_KEY } from './(onboarding)/index';

type BootState = 'loading' | 'onboarding' | 'auth' | 'home';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [bootState, setBootState] = useState<BootState>('loading');

  useEffect(() => {
    if (isLoading) return;

    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then((value) => {
      if (!value) {
        setBootState('onboarding');
      } else if (isAuthenticated) {
        setBootState('home');
      } else {
        setBootState('auth');
      }
    });
  }, [isLoading, isAuthenticated]);

  if (bootState === 'loading' || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  if (bootState === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  if (bootState === 'home') {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
});
