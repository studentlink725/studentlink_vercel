import { Stack, useRouter, useSegments } from "expo-router";
import { StudentProvider, useStudent } from "../src/data/persona-context";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase";
import { View, ActivityIndicator } from "react-native";
import { COLORS } from "../src/components/Theme";

function InitialRouteGuard() {
  const { studentData, loading } = useStudent();
  const segments = useSegments();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    const checkNavigation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const inAuthGroup = segments[0] === "(auth)";

      if (!user) {
        // Not logged in: Redirect to auth if not already there
        if (!inAuthGroup) {
          router.replace("/(auth)");
        }
      } else {
        // Logged in
        if (studentData) {
          // Has profile: Redirect to dashboard if in auth group
          if (inAuthGroup) {
            router.replace("/(tabs)");
          }
        } else {
          // Logged in but no profile: Go to onboarding
          // Check if already on onboarding to avoid loops
          const onOnboarding = segments[segments.length - 1] === "onboarding";
          if (!onOnboarding) {
            router.replace("/(auth)/onboarding");
          }
        }
      }
      setAuthChecked(true);
    };

    checkNavigation();
  }, [studentData, loading, segments]);

  if (loading || !authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StudentProvider>
        <InitialRouteGuard />
      </StudentProvider>
    </SafeAreaProvider>
  );
}
