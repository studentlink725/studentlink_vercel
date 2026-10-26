import { Tabs } from "expo-router";
import { Home, Users, Compass, User, Calendar } from "lucide-react-native";
import { COLORS } from "../../src/components/Theme";
import { ProfileSettings } from "../../src/components/ProfileSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate tab bar height based on safe area insets
  // On modern phones, insets.bottom is usually ~34px. On older phones, it's 0.
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const tabBarHeight = 50 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.mutedForeground,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.background,
        },
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerRight: () => <ProfileSettings />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          headerTitle: "StudentLink",
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="matching"
        options={{
          title: "Connections",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          headerTitle: "Connections",
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: "Resources",
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
        }}
      />
    </Tabs>
  );
}
