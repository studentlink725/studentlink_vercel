import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Sparkles, ChevronRight, BookOpen, HeartPulse, DollarSign, Briefcase } from "lucide-react-native";
import { useStudent } from "../../src/data/persona-context";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import { supabase } from "../../src/lib/supabase";
import { LocationLink } from "../../src/components/LocationLink";

const getInitials = (name: string) => {
  if (!name) return "S";
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (startStr: string, endStr?: string | null) => {
  if (!startStr) return "";
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;
  
  const startFormatted = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (end) {
    if (start.toDateString() !== end.toDateString()) {
      const endFormatted = end.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${startFormatted} - ${endFormatted}`;
    }
    const endFormatted = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${startFormatted} - ${endFormatted}`;
  }

  return startFormatted;
};

export default function Dashboard() {
  const { studentData, loading } = useStudent();
  const router = useRouter();

  const [bestEvent, setBestEvent] = useState<any>(null);
  const [topPeer, setTopPeer] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function loadDashboardData() {
        if (!studentData) return;

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // Load Top Peer
        if (userId) {
          // Trigger a background match computation (bypassed instantly if on cooldown)
          await supabase.rpc("recompute_scores_for_user");
          
          const { data: peerData } = await supabase.rpc("get_matching_peers");
          if (peerData && peerData.length > 0) {
            if (isActive) setTopPeer(peerData[0]);
          } else {
            if (isActive) setTopPeer(null);
          }
        }

        // Load Best Event
        const userInterests = (studentData.interests || []).map(
          (i: any) => i.interest
        );
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .order("start_time", { ascending: true });

        if (eventsData && eventsData.length > 0 && isActive) {
          // Find an event matching user interests
          const matched = eventsData.find((e) =>
            e.tags?.some((tag: string) =>
              userInterests.some((ui: string) => ui.includes(tag))
            )
          );
          setBestEvent(matched || eventsData[0]);
        }

        if (isActive) setDataLoading(false);
      }
      loadDashboardData();
      
      return () => { isActive = false; };
    }, [studentData])
  );

  if (loading || (!studentData && dataLoading)) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const displayName = studentData?.name || "Student";
  const firstName = displayName.split(" ")[0];

  const courseCount = studentData?.courses?.length || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.schoolTag}>
          {studentData?.school?.toUpperCase()}
          {studentData?.major && ` · ${studentData.major.toUpperCase()}`}
          {studentData?.year && ` · YEAR ${studentData.year === 5 ? "5+" : studentData.year}`}
        </Text>
        <Text style={styles.greeting}>Hey, {firstName}.</Text>
        <Text style={styles.subGreeting}>
          You're enrolled in {courseCount}{" "}
          {courseCount === 1 ? "class" : "classes"} this semester.
        </Text>
      </View>



      {/* Surfaced for You */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Surfaced for You</Text>
            <Sparkles size={16} color={COLORS.primary} style={{ marginLeft: 6 }} />
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/events")}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {bestEvent ? (
          <TouchableOpacity
            style={styles.surfacedCard}
            onPress={() => router.push("/(tabs)/events")}
          >
            <View style={styles.emojiBox}>
              <Text style={styles.emojiText}>📅</Text>
            </View>
            <View style={styles.surfacedInfo}>
              {bestEvent.tags && bestEvent.tags.length > 0 && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>
                    {bestEvent.tags[0]}
                  </Text>
                </View>
              )}
              <Text style={styles.surfacedEventTitle}>{bestEvent.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.surfacedEventSub}>
                  {formatDate(bestEvent.start_time, bestEvent.end_time)}
                </Text>
                {bestEvent.location && (
                  <>
                    <Text style={styles.surfacedEventSub}> - </Text>
                    <LocationLink
                      location={bestEvent.location}
                      city={bestEvent.city}
                      province_state={bestEvent.province_state}
                      country={bestEvent.country}
                      style={[styles.surfacedEventSub, { textDecorationLine: 'underline', color: COLORS.primary }]}
                    />
                  </>
                )}
              </View>
            </View>
            <ChevronRight size={16} color={COLORS.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>We're looking for the best events for you. Add more interests to improve recommendations.</Text>
          </View>
        )}
      </View>

      {/* Top Match */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top peer match</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/matching")}>
            <Text style={styles.viewAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {topPeer ? (
          <TouchableOpacity
            style={styles.matchCard}
            onPress={() => router.push("/(tabs)/matching")}
          >
            <View style={styles.matchHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(topPeer.peer_name)}
                </Text>
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchName}>{topPeer.peer_name}</Text>
                <Text style={styles.matchSubtitle}>
                  {topPeer.peer_major} · Year {topPeer.peer_year}
                </Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>
                  {topPeer.match_percentage}% Match
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>No matches found yet. We'll notify you when new peers join!</Text>
          </View>
        )}
      </View>

      {/* Resource Hub */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{studentData?.school || "Campus"} Resource Hub</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/resources")}>
            <Text style={styles.viewAll}>Open hub</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.resourceGrid}>
          {[
            {
              id: "academic",
              icon: BookOpen,
              title: "Academic Support",
              services: 6,
              bg: "#EFF6FF",
            },
            {
              id: "wellness",
              icon: HeartPulse,
              title: "Mental Health",
              services: 4,
              bg: "#E0F4F8",
            },
            {
              id: "financial",
              icon: DollarSign,
              title: "Financial Aid",
              services: 6,
              bg: "#ECFDF5",
            },
            {
              id: "career",
              icon: Briefcase,
              title: "Career Services",
              services: 2,
              bg: "#FFFBEB",
            },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.resourceGridCard}
                onPress={() => router.push({ pathname: "/(tabs)/resources", params: { category: cat.id } })}
              >
                <View style={[styles.resourceGridIconBox, { backgroundColor: cat.bg }]}>
                  <Icon size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.resourceGridCardTitle}>{cat.title}</Text>
                <Text style={styles.resourceGridCardSub}>
                  {cat.services} {cat.services === 1 ? "service" : "services"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  schoolTag: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.mutedForeground,
    letterSpacing: 0.8,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.foreground,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginTop: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  proactiveCard: {
    backgroundColor: "#020817",
    borderRadius: 16,
    padding: 16,
    marginBottom: SPACING.lg,
  },
  proactiveSignal: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  proactiveDot: {
    width: 8,
    height: 8,
    backgroundColor: "#22C55E",
    borderRadius: 4,
    marginRight: 6,
  },
  proactiveTag: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0081A7",
    letterSpacing: 0.8,
  },
  proactiveTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  proactiveBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    lineHeight: 18,
  },
  proactiveButton: {
    marginTop: 14,
    height: 40,
    backgroundColor: "#fff",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  proactiveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  surfacedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  emojiBox: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 22,
  },
  surfacedInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  categoryTag: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  surfacedEventTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  surfacedEventSub: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  matchCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: "rgba(37, 99, 235, 0.2)",
    borderRadius: 16,
    padding: 16,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  matchName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  matchSubtitle: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resourceGridCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  resourceGridIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  resourceGridCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.foreground,
    lineHeight: 18,
  },
  resourceGridCardSub: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  emptyStateCard: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  }
});
