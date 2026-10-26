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
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import { ArrowRight, Key } from "lucide-react-native";
import { supabase } from "../../src/lib/supabase";

export default function Verify() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      Alert.alert("Error", "Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    // 1. Verify the OTP
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email as string,
      token: code,
      type: 'email', 
    });

    if (verifyError) {
      Alert.alert("Verification Error", verifyError.message);
      setLoading(false);
      return;
    }
    
    await checkProfile(data.user?.id);
  };

  const checkProfile = async (userId: string | undefined) => {
    if (!userId) {
      Alert.alert("Error", "Failed to obtain user ID after verification.");
      setLoading(false);
      return;
    }

    // Check if profile exists by ID (Primary Key)
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
      // Profile exists, skip to dashboard
      setLoading(false);
      router.replace("/(tabs)");
    } else {
      // Profile doesn't exist, go to onboarding 
      // (The actual record creation happens in onboarding.tsx Step 1 after school is selected)
      setLoading(false);
      router.push({
        pathname: "/(auth)/onboarding",
        params: { email: email }
      });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {email}.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Key size={20} color={COLORS.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={COLORS.mutedForeground}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!loading}
              />
              {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <TouchableOpacity
              style={[styles.button, (code.length < 6 || loading) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={code.length < 6 || loading}
            >
              <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify"}</Text>
              {!loading && <ArrowRight size={20} color={COLORS.background} />}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.back()}
              disabled={loading}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back to Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    letterSpacing: 8,
    fontWeight: "bold",
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
  backButton: {
    marginTop: SPACING.sm,
    alignItems: "center",
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
