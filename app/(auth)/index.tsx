import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import { ArrowRight, Mail } from "lucide-react-native";
import { supabase } from "../../src/lib/supabase";

export default function Welcome() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Set to true to skip OTP and use silent auth for testing
  const BYPASS_AUTH = true;

  const handleNext = async () => {
    const emailLower = email.trim().toLowerCase();

    if (!emailLower || !emailLower.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);

    if (BYPASS_AUTH) {
      const tempPassword = "dev_simulated_password_123";

      // 1. Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password: tempPassword,
      });

      let userId: string | undefined;

      if (signInError) {
        // 2. Try to sign up if sign-in fails
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: emailLower,
          password: tempPassword,
        });

        if (signUpError) {
          Alert.alert("Bypass Auth Error", signUpError.message);
          setLoading(false);
          return;
        }
        userId = signUpData.user?.id;
      } else {
        userId = signInData.user?.id;
      }

      if (userId) {
        // 3. Profile Check (Logic matches verify.tsx)
        const { data: student, error: profileError } = await supabase
          .from('students')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.error("Error checking profile:", profileError.message);
          Alert.alert("Database Error", "Failed to load profile. Please try again.");
          setLoading(false);
          return;
        }

        if (student) {
          // Returning user: Go to dashboard
          setLoading(false);
          router.replace("/(tabs)");
        } else {
          // New user: Go to onboarding (Creation happens in onboarding.tsx Step 1)
          setLoading(false);
          router.push({
            pathname: "/(auth)/onboarding",
            params: { email: emailLower }
          });
        }
      } else {
        Alert.alert("Error", "Failed to obtain user ID.");
        setLoading(false);
      }
      return;
    }

    // REAL OTP FLOW
    const { error } = await supabase.auth.signInWithOtp({
      email: emailLower,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      Alert.alert("Error", error.message);
      setLoading(false);
    } else {
      setLoading(false);
      router.push({
        pathname: "/(auth)/verify",
        params: { email: emailLower }
      });
    }
  };

  const page = (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.title}>Welcome to StudentLink</Text>
            <Text style={styles.subtitle}>
              Enter your email to get started.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Mail size={20} color={COLORS.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your-email@example.com"
                placeholderTextColor={COLORS.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
              {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <TouchableOpacity
              style={[styles.button, (!email || loading) && styles.buttonDisabled]}
              onPress={andleNext}
              disabled={!email || loading}
            >
              <Text style={styles.buttonText}>{loading ? "Authenticating..." : "Next"}</Text>
              {!loading && <ArrowRight size={20} color={COLORS.background} />}
            </TouchableOpacity>
          </View>
        </View>
    </KeyboardAvoidingView>
  );

  return Platform.OS === "web" ? page : (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{page}</TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: "center",
  },
  header: {
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  logoText: {
    color: COLORS.background,
    fontSize: 24,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.mutedForeground,
    marginTop: SPACING.xs,
  },
  form: {
    gap: SPACING.md,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.foreground,
  },
  button: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: "bold",
  },
});
