import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/src/api/trpc";
import { TRPCProvider } from "@/src/api/provider";
import { useAuthStore } from "@/src/stores/authStore";
import { colors } from "@/src/utils/colors";

function AuthBootstrap() {
  const { data: session, isPending } = authClient.useSession();
  const setUser = useAuthStore((state) => state.setUser);
  const finishLoading = useAuthStore((state) => state.finishLoading);

  const profileQuery = trpc.auth.getMobileProfile.useQuery(undefined, {
    enabled: !!session?.user,
    retry: false,
  });

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session?.user) {
      setUser(null);
      finishLoading();
      return;
    }

    if (profileQuery.data) {
      setUser(profileQuery.data);
      return;
    }

    if (profileQuery.isError) {
      finishLoading();
    }
  }, [
    finishLoading,
    isPending,
    profileQuery.data,
    profileQuery.isError,
    session?.user,
    setUser,
  ]);

  const isBooting = isPending || (!!session?.user && profileQuery.isPending);

  if (isBooting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.primary[800]} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.secondary },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TRPCProvider>
          <AuthBootstrap />
        </TRPCProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
  },
});
