import React from "react";
import { 
  TouchableOpacity, 
  StyleSheet, 
  DeviceEventEmitter,
} from "react-native";
import { COLORS, SPACING } from "./Theme";
import { 
  UserCircle, 
} from "lucide-react-native";
import { useRouter } from "expo-router";

export function ProfileSettings() {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.button} onPress={() => {
      DeviceEventEmitter.emit('resetProfileView');
      router.push("/(tabs)/profile");
    }}>
      <UserCircle size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
});
