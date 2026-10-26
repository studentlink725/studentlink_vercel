import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Modal,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import {
  BookOpen,
  DollarSign,
  HeartPulse,
  Briefcase,
  Users,
  Globe,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ExternalLink,
  Building,
} from "lucide-react-native";

// ─── DATA ─────────────────────────────────────────────────────────────
const RESOURCE_CATEGORIES = [
  {
    id: "academic",
    title: "Academic Support",
    icon: BookOpen,
    bg: "#EFF6FF",
    data: [
      {
        name: "Tutorial & Academic Coaching Services",
        desc: "tutoring, writing help, study strategies",
        url: "https://www.norquest.ca/student-services/tutorial-and-academic-coaching-services/",
        org: "NorQuest",
      },
      {
        name: "NorQuest Library",
        desc: "research help, study rooms, citation support, tech loans",
        url: "https://www.norquest.ca/student-services/library/",
        org: "NorQuest",
      },
      {
        name: "Accessibility Services",
        desc: "accommodations, assistive tech, exam accommodations",
        url: "https://www.norquest.ca/student-resources/academic-supports.aspx",
        org: "NorQuest",
      },
      {
        name: "Testing and Assessment Services",
        desc: "placement testing, challenge exams, proctored exams",
        url: "mailto:testing@norquest.ca",
        org: "NorQuest",
      },
      {
        name: "Student Advisors",
        desc: "general academic/enrolment guidance, first point of contact",
        url: "https://www.norquest.ca/applying-to-norquest/get-help-with-your-application/contact-a-student-advisor/",
        org: "NorQuest",
      },
      {
        name: "Student Resolution and Integrity Office",
        desc: "grade disputes, misconduct, complaints",
        url: "https://www.norquest.ca/about-norquest/college-directory/",
        org: "NorQuest",
      },
    ],
  },
  {
    id: "financial",
    title: "Financial Aid",
    icon: DollarSign,
    bg: "#ECFDF5",
    data: [
      {
        name: "Funding Your Education (hub)",
        desc: "main entry point for all funding options",
        url: "https://www.norquest.ca/applying-to-norquest/funding-your-education/",
        org: "NorQuest",
      },
      {
        name: "Scholarships, Bursaries & Awards",
        desc: "",
        url: "https://www.norquest.ca/applying-to-norquest/funding-your-education/scholarships-and-bursaries/",
        org: "NorQuest",
      },
      {
        name: "Government Student Aid",
        desc: "loans and grants",
        url: "https://www.norquest.ca/applying-to-norquest/funding-your-education/student-loans/",
        org: "NorQuest",
      },
      {
        name: "Foundational Learning Assistance",
        desc: "for Academic Upgrading / EAL / Transitions to Employment students",
        url: "https://www.norquest.ca/applying-to-norquest/funding-your-education/foundational-learning-assistance-funding/",
        org: "NorQuest",
      },
      {
        name: "Emergency Funding",
        desc: "short-term emergency loans for enrolled credit students",
        url: "https://www.norquest.ca/applying-to-norquest/funding-your-education/emergency-funding/",
        org: "NorQuest",
      },
      {
        name: "Your Finances (overview)",
        desc: "fee payment, student loan mechanics",
        url: "https://www.norquest.ca/get-ready/your-finances/",
        org: "NorQuest",
      },
    ],
  },
  {
    id: "wellness",
    title: "Mental Health",
    icon: HeartPulse,
    bg: "#E0F4F8",
    data: [
      {
        name: "Community Resources & Crisis Contacts",
        desc: "includes Distress Line, Alberta Mental Health Help Line, 211",
        url: "https://www.norquest.ca/student-resources/health-and-wellness-supports/community-resources.aspx",
        org: "NorQuest",
        urgent: true,
      },
      {
        name: "Mental Health Services",
        desc: "free, confidential counselling for students",
        url: "https://www.norquest.ca/student-services/health-and-wellness-supports/mental-health/",
        org: "NorQuest",
      },
      {
        name: "Health and Wellness Supports (hub)",
        desc: "nursing, wellness workshops, referrals",
        url: "https://www.norquest.ca/student-resources/health-and-wellness-supports.aspx",
        org: "NorQuest",
      },
      {
        name: "Your Wellbeing (overview)",
        desc: "",
        url: "https://www.norquest.ca/get-ready/your-wellbeing/",
        org: "NorQuest",
      },
    ],
  },
  {
    id: "career",
    title: "Career Services",
    icon: Briefcase,
    bg: "#FFFBEB",
    data: [
      {
        name: "Career Centre / Career Supports",
        desc: "career coaching, resume/interview help",
        url: "https://www.norquest.ca/student-services/career-supports/",
        org: "NorQuest",
      },
      {
        name: "CareerQuest Hub",
        desc: "student job board, login required",
        url: "https://cqhub.norquest.ca/",
        org: "NorQuest",
      },
    ],
  },
  {
    id: "campus",
    title: "Campus Life",
    icon: Users,
    bg: "#EFF6FF",
    data: [
      {
        name: "SANQC — About / Advocacy",
        desc: "who they are, student rights advocacy",
        url: "https://www.sanqc.ca/about/",
        org: "SANQC",
      },
      {
        name: "SANQC — Services Offered",
        desc: "Health & Dental, U-Pass",
        url: "https://www.sanqc.ca/services-offered/",
        org: "SANQC",
      },
      {
        name: "Campus SafeWalk",
        desc: "safety escort service",
        url: "https://www.sanqc.ca/campussafewalk/",
        org: "SANQC",
      },
      {
        name: "Student Clubs Directory",
        desc: "",
        url: "https://www.sanqc.ca/get-involved/student-clubs/clubs-directory/",
        org: "SANQC",
      },
      {
        name: "Volunteer Opportunities",
        desc: "",
        url: "https://www.sanqc.ca/get-involved/volunteer/",
        org: "SANQC",
      },
      {
        name: "Events Calendar",
        desc: "",
        url: "https://www.sanqc.ca/events-calendar/",
        org: "SANQC",
      },
    ],
  },
  {
    id: "equity",
    title: "Identity & Equity",
    icon: Globe,
    bg: "#FFF1F2",
    data: [
      {
        name: "Indigenous Student Services",
        desc: "cultural advisor, Indigenous student advisor",
        url: "https://www.norquest.ca/student-services/indigenous-student-services/",
        org: "NorQuest",
      },
      {
        name: "International Student Services",
        desc: "Financial Support",
        url: "https://www.norquest.ca/international-students/international-student-services/financial-support/",
        org: "NorQuest",
      },
    ],
  },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────

export default function Resources() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { category } = useLocalSearchParams<{ category: string }>();

  const handleCloseModal = () => {
    setSelectedCategory(null);
  };

  useEffect(() => {
    if (category) {
      const found = RESOURCE_CATEGORIES.find((c) => c.id === category);
      if (found) {
        setSelectedCategory(found);
      }
    }
  }, [category]);

  const handleOpenURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Failed to open URL", error);
    }
  };

  // Flatten all data for search
  const allServices = RESOURCE_CATEGORIES.flatMap((c) => c.data);
  const searchResults = searchQuery
    ? allServices.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.desc?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const renderServiceCard = (item: any) => {
    const isUrgent = item.urgent;
    const isSanqc = item.org === "SANQC";

    return (
      <TouchableOpacity
        key={item.name}
        style={[styles.serviceCard, isUrgent && styles.cardUrgent]}
        onPress={() => handleOpenURL(item.url)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isUrgent && styles.textUrgent]}>
            {item.name}
          </Text>
          <View
            style={[
              styles.orgBadge,
              isSanqc ? styles.orgBadgeSanqc : styles.orgBadgeNorquest,
            ]}
          >
            <Building
              size={10}
              color={isSanqc ? "#4F46E5" : COLORS.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.orgBadgeText,
                isSanqc
                  ? styles.orgBadgeTextSanqc
                  : styles.orgBadgeTextNorquest,
              ]}
            >
              {item.org}
            </Text>
          </View>
        </View>

        {item.desc ? (
          <Text style={[styles.cardDesc, isUrgent && styles.textUrgentDesc]}>
            {item.desc}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          {item.url.startsWith("mailto:") ? (
            <Text style={styles.linkUrl}>Email support</Text>
          ) : (
            <View style={styles.externalLinkRow}>
              <Text style={styles.linkUrl} numberOfLines={1} ellipsizeMode="tail">
                {item.url.replace(/^https?:\/\//, "").split("/")[0]}
              </Text>
              <ExternalLink
                size={12}
                color={COLORS.mutedForeground}
                style={{ marginLeft: 4 }}
              />
            </View>
          )}
          <ChevronRight
            size={16}
            color={isUrgent ? "#BE123C" : COLORS.mutedForeground}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── HUB VIEW (Figma Layout) ─── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, SPACING.md) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Resource Hub</Text>
          <Text style={styles.pageSubtitle}>
            Support services at NorQuest, organized for you.
          </Text>
        </View>

        {/* <View style={styles.searchBar}>
          <Search size={20} color={COLORS.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service..."
            placeholderTextColor={COLORS.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View> */}

        {searchQuery.length > 0 ? (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.sectionHeaderTitle}>
              Search Results ({searchResults.length})
            </Text>
            <View style={{ marginTop: SPACING.md }}>
              {searchResults.length > 0 ? (
                searchResults.map((item) => renderServiceCard(item))
              ) : (
                <Text style={styles.noResultsText}>No matching services found.</Text>
              )}
            </View>
          </View>
        ) : (
          <>

            <View style={styles.gridContainer}>
              {RESOURCE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.gridCard}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <View style={[styles.gridIconBox, { backgroundColor: cat.bg }]}>
                      <Icon size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.gridCardTitle}>{cat.title}</Text>
                    <Text style={styles.gridCardSub}>
                      {cat.data.length} {cat.data.length === 1 ? "service" : "services"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginTop: SPACING.xl, marginBottom: SPACING.xl }}>
              <Text style={[styles.sectionHeaderTitle, { marginBottom: SPACING.md }]}>
                24/7 Crisis Support
              </Text>
              {renderServiceCard({
                name: "Community Resources & Crisis Contacts",
                desc: "includes Distress Line, Alberta Mental Health Help Line, 211",
                url: "https://www.norquest.ca/student-resources/health-and-wellness-supports/community-resources.aspx",
                org: "NorQuest",
                urgent: true,
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── CATEGORY DETAIL MODAL ─── */}
      <Modal
        visible={selectedCategory !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        {selectedCategory && (
          <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleCloseModal}
              >
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedCategory.title}</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
            >
              {selectedCategory.data.map((item: any) => renderServiceCard(item))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.foreground,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.foreground,
  },
  recommendedSection: {
    marginBottom: SPACING.xl,
  },
  recommendedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  recommendedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: "rgba(37,99,235,0.2)",
    borderRadius: 16,
  },
  recommendedIconBox: {
    width: 40,
    height: 40,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  recommendedInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  recommendedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  recommendedDesc: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  gridIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.foreground,
    lineHeight: 18,
  },
  gridCardSub: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  // Modal specific
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  modalContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  // Cards
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardUrgent: {
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.foreground,
    flex: 1,
    marginRight: SPACING.sm,
  },
  textUrgent: {
    color: "#BE123C",
  },
  textUrgentDesc: {
    color: "#9F1239",
  },
  orgBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  orgBadgeNorquest: {
    backgroundColor: "rgba(37,99,235,0.1)",
  },
  orgBadgeSanqc: {
    backgroundColor: "rgba(79,70,229,0.1)",
  },
  orgBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  orgBadgeTextNorquest: {
    color: COLORS.primary,
  },
  orgBadgeTextSanqc: {
    color: "#4F46E5",
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginTop: 6,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  externalLinkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  linkUrl: {
    fontSize: 11,
    color: COLORS.mutedForeground,
  },
  noResultsText: {
    fontSize: 15,
    color: COLORS.mutedForeground,
    textAlign: "center",
    marginTop: SPACING.xl,
  }
});
