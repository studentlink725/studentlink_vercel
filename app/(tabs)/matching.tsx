import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  DeviceEventEmitter,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStudent } from "../../src/data/persona-context";
import { supabase } from "../../src/lib/supabase";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import {
  Sparkles,
  Users,
  UserPlus,
  MessageSquareText,
  BadgeInfo,
  ArrowRight,
  ShieldCheck,
  Compass,
  Heart,
  X,
  UserCheck,
  MessageCircle,
  Clock,
  AtSign,
  Pencil,
  FileText
} from "lucide-react-native";

type SectionKey = "matches" | "pending" | "incoming" | "friends";

interface MatchItem {
  peer_id: string;
  peer_name: string;
  peer_school: string;
  peer_year: number;
  peer_major: string;
  shared_interests: string[];
  shared_courses: string[];
  match_percentage: number;
}

interface IncomingRequestItem {
  request_id: string;
  requester_id: string;
  requester_name: string;
  requester_major: string;
  requester_year: number | null;
  request_message: string | null;
  created_at: string;
}

interface OutgoingRequestItem {
  request_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_major: string;
  recipient_year: number | null;
  request_message: string | null;
  created_at: string;
}

interface FriendItem {
  friend_id: string;
  friend_name: string;
  friend_major: string;
  friend_year: number | null;
  created_at: string;
  bio_line: string | null;
  avatar_url?: string | null;
}

const getInitials = (name: string) => {
  if (!name) return "S";
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatInterest = (interest: string) => {
  const parts = interest.split(": ");
  return parts[1] || interest;
};

export default function Matching() {
  const router = useRouter();
  const { studentData, refreshData, updateStudentData } = useStudent();
  const [activeSection, setActiveSection] = useState<SectionKey>("matches");

  const toggleShareBio = async (val: boolean) => {
    updateStudentData({ share_bio: val });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from("students")
          .update({ share_bio: val })
          .eq("id", session.user.id);
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Failed to update share_bio:", err.message);
      Alert.alert("Error", "Could not save settings. Please try again.");
      updateStudentData({ share_bio: !val });
    }
  };
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequestItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [pendingPeer, setPendingPeer] = useState<MatchItem | null>(null);
  const [pendingPeerIds, setPendingPeerIds] = useState<Set<string>>(new Set());

  const schoolName = studentData?.school || "your school";

  const sectionMeta = useMemo(
    () => ({
      matches: {
        label: "Matches",
        title: "Recommended people",
        description: "Profiles surfaced for you based on majors, interests, and availability.",
        icon: Sparkles,
      },
      pending: {
        label: "Pending",
        title: "Sent requests",
        description: "Connections you have sent out and are waiting on.",
        icon: Clock,
      },
      incoming: {
        label: "Incoming",
        title: "Incoming connections",
        description: "Requests from people who tapped connect on your profile.",
        icon: UserPlus,
      },
      friends: {
        label: "Friends",
        title: "Friends and shared info",
        description: "People you’ve already connected with and the contact details they chose to share.",
        icon: ShieldCheck,
      },
    }),
    []
  );

  const fetchMatches = useCallback(async (shouldBootstrap = true) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase.rpc("get_matching_peers");
      if (error) {
        console.error("Error fetching matches:", error.message);
        return;
      }

      if (data && data.length > 0) {
        setMatches(data);
      } else if (shouldBootstrap) {
        // Show screen immediately; recompute in background
        setBootstrapping(true);
        setLoading(false);
        (async () => {
          try {
            const { error: runError } = await supabase.rpc("recompute_scores_for_user");
            if (runError) console.error("Bootstrap recompute error:", runError.message);
            const { data: refetchedData } = await supabase.rpc("get_matching_peers");
            if (refetchedData) setMatches(refetchedData);
          } catch (err: any) {
            console.error("Bootstrap failed:", err.message);
          } finally {
            setBootstrapping(false);
          }
        })();
        return;
      }
    } catch (err: any) {
      console.error("Failed matches fetch operation:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIncomingRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_incoming_connection_requests");
      if (error) {
        console.error("Error fetching incoming requests:", error.message);
        return;
      }
      setIncomingRequests(data ?? []);
    } catch (err: any) {
      console.error("Failed incoming request fetch:", err.message);
    }
  }, []);

  const fetchOutgoingRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_outgoing_connection_requests");
      if (error) {
        console.error("Error fetching outgoing requests:", error.message);
        return;
      }
      setOutgoingRequests(data ?? []);
    } catch (err: any) {
      console.error("Failed outgoing request fetch:", err.message);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_friend_connections");
      if (error) {
        console.error("Error fetching friends:", error.message);
        return;
      }
      setFriends(data ?? []);
    } catch (err: any) {
      console.error("Failed friend fetch:", err.message);
    }
  }, []);

  useEffect(() => {
    if (studentData?.matching_enabled) {
      // Run all 4 fetches in parallel — do NOT await sequentially
      Promise.all([
        fetchMatches(true),
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
        fetchFriends(),
      ]);
    }
  }, [studentData?.matching_enabled, fetchMatches, fetchIncomingRequests, fetchOutgoingRequests, fetchFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        // Fetch fresh data in parallel — no heavy recompute on every pull
        const [matchRes, , , ] = await Promise.all([
          supabase.rpc("get_matching_peers"),
          fetchIncomingRequests(),
          fetchOutgoingRequests(),
          fetchFriends(),
        ]);
        if (matchRes.data) setMatches(matchRes.data);
      }
    } catch (err: any) {
      console.error("Refresh matches failed:", err.message);
    } finally {
      setRefreshing(false);
    }
  }, [fetchIncomingRequests, fetchOutgoingRequests, fetchFriends]);

  const enableDiscovery = async () => {
    updateStudentData({ matching_enabled: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        await supabase.from("students").update({ matching_enabled: true }).eq("id", user.id);
        refreshData();
      }
    } catch (err: any) {
      console.error("Failed to enable matching discovery:", err.message);
    }
  };

  const openRequestComposer = (peer: MatchItem) => {
    setPendingPeer(peer);
    setRequestMessage("");
    setRequestModalVisible(true);
  };

  const closeRequestComposer = () => {
    setRequestModalVisible(false);
    setPendingPeer(null);
    setRequestMessage("");
  };

  const submitConnectionRequest = async (message?: string | null) => {
    if (!pendingPeer) return;

    const cleanedMessage = (message ?? requestMessage).trim();
    if (cleanedMessage.length > 128) {
      Alert.alert("Message too long", "Keep connection messages to 128 characters or fewer.");
      return;
    }

    try {
      const { error } = await supabase.rpc("send_connection_request", {
        target_peer_id: pendingPeer.peer_id,
        request_message: cleanedMessage.length > 0 ? cleanedMessage : null,
      });

      if (error) {
        console.error("Error sending connection request:", error.message);
        Alert.alert("Could not send request", error.message);
        return;
      }

      setPendingPeerIds((prev) => new Set(prev).add(pendingPeer.peer_id));
      closeRequestComposer();
      Alert.alert(
        "Request sent",
        cleanedMessage.length > 0
          ? "Your note was attached to the connection request."
          : "The connection request was sent without a message."
      );
      setMatches((prev) => prev.filter((m) => m.peer_id !== pendingPeer.peer_id));
      fetchOutgoingRequests();
      setActiveSection("pending");
    } catch (err: any) {
      console.error("Failed to send connection request:", err.message);
      Alert.alert("Could not send request", "Please try again.");
    }
  };

  const withdrawRequest = async (requestId: string, recipientId: string) => {
    try {
      const { error } = await supabase.rpc("withdraw_connection_request", { request_id: requestId });
      if (error) {
        console.error("Error withdrawing request:", error.message);
        Alert.alert("Error", "Could not withdraw this request. Please try again.");
        return;
      }

      setOutgoingRequests((prev) => prev.filter((request) => request.request_id !== requestId));
      setPendingPeerIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(recipientId);
        return newSet;
      });
      fetchMatches(false); // Reload matches so they reappear
    } catch (err: any) {
      console.error("Failed to withdraw request:", err.message);
      Alert.alert("Error", "Could not withdraw this request. Please try again.");
    }
  };

  const handleIgnore = async (peerId: string) => {
    setMatches((prev) => prev.filter((m) => m.peer_id !== peerId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { error } = await supabase.rpc("ignore_peer", {
        ignored_peer_id: peerId,
      });

      if (error) {
        console.error("Error ignoring peer:", error.message);
        Alert.alert("Error", "Could not ignore user. Please try again.");
        fetchMatches(false);
      } else {
        const { data: refetchedData } = await supabase.rpc("get_matching_peers");
        if (refetchedData) setMatches(refetchedData);
      }
    } catch (err: any) {
      console.error("Failed to ignore peer:", err.message);
    }
  };

  const acceptIncomingRequest = async (requestId: string, requesterId: string) => {
    try {
      const { error } = await supabase.rpc("accept_connection_request", { request_id: requestId });
      if (error) {
        console.error("Error accepting request:", error.message);
        Alert.alert("Error", "Could not accept this request. Please try again.");
        return;
      }

      setIncomingRequests((prev) => prev.filter((request) => request.request_id !== requestId));
      setPendingPeerIds((prev) => new Set(prev).add(requesterId));
      await fetchFriends();
    } catch (err: any) {
      console.error("Failed to accept incoming request:", err.message);
      Alert.alert("Error", "Could not accept this request. Please try again.");
    }
  };

  const declineIncomingRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc("decline_connection_request", { request_id: requestId });
      if (error) {
        console.error("Error declining request:", error.message);
        Alert.alert("Error", "Could not ignore this request. Please try again.");
        return;
      }

      setIncomingRequests((prev) => prev.filter((request) => request.request_id !== requestId));
    } catch (err: any) {
      console.error("Failed to decline incoming request:", err.message);
      Alert.alert("Error", "Could not ignore this request. Please try again.");
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { error } = await supabase.rpc("remove_friend_connection", {
        target_peer_id: friendId,
      });
      if (error) {
        console.error("Error removing friend:", error.message);
        Alert.alert("Error", "Could not remove this friend. Please try again.");
        return;
      }

      setFriends((prev) => prev.filter((friend) => friend.friend_id !== friendId));
    } catch (err: any) {
      console.error("Failed to remove friend:", err.message);
    }
  };

  const renderMatchCard = ({ item }: { item: MatchItem }) => {
    const isPending = pendingPeerIds.has(item.peer_id);
    const scoreColor =
      item.match_percentage >= 70 ? COLORS.primary :
      item.match_percentage >= 40 ? COLORS.foreground : COLORS.mutedForeground;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.peer_name)}</Text>
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.name}>{item.peer_name}</Text>
            <Text style={styles.meta}>
              {item.peer_major} • Year {item.peer_year}
            </Text>
          </View>
          <View style={[styles.scorePill, { borderColor: scoreColor }]}>
            <Sparkles size={12} color={scoreColor} />
            <Text style={[styles.scoreText, { color: scoreColor }]}>{item.match_percentage}%</Text>
          </View>
        </View>

        {item.shared_interests?.length > 0 && (
          <View style={styles.interestsBlock}>
            <Text style={styles.blockLabel}>Shared interests</Text>
            <View style={styles.tagRow}>
              {item.shared_interests.map((interest) => (
                <View key={interest} style={styles.tag}>
                  <Text style={styles.tagText}>{formatInterest(interest)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryAction, isPending && styles.primaryActionActive]}
            activeOpacity={0.85}
            onPress={() => openRequestComposer(item)}
          >
            {isPending ? (
              <>
                <UserCheck size={16} color={COLORS.background} />
                <Text style={styles.primaryActionText}>Pending</Text>
              </>
            ) : (
              <>
                <Heart size={16} color={COLORS.background} />
                <Text style={styles.primaryActionText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ignoreButton} onPress={() => handleIgnore(item.peer_id)}>
            <X size={16} color={COLORS.mutedForeground} />
            <Text style={styles.ignoreButtonText}>Ignore</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!studentData?.matching_enabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Compass size={64} color={COLORS.mutedForeground} style={{ marginBottom: SPACING.lg }} />
          <Text style={styles.emptyTitle}>Discovery Mode is Off</Text>
          <Text style={styles.emptyDescription}>
            Enable Discovery Mode to see potential student matches and allow peers at your school to discover you.
          </Text>
          <TouchableOpacity style={styles.enableButton} onPress={enableDiscovery}>
            <Text style={styles.enableButtonText}>Enable Discovery Mode</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={requestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRequestComposer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a note?</Text>
            <Text style={styles.modalSubtitle}>
              Send a short message with your connection request, or send it without a message.
            </Text>

            {pendingPeer && (
              <View style={styles.modalPeerRow}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.avatarText}>{getInitials(pendingPeer.peer_name)}</Text>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.name}>{pendingPeer.peer_name}</Text>
                  <Text style={styles.meta}>
                    {pendingPeer.peer_major} • Year {pendingPeer.peer_year}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              value={requestMessage}
              onChangeText={(text) => setRequestMessage(text.slice(0, 128))}
              placeholder="Write a short note..."
              placeholderTextColor={COLORS.mutedForeground}
              maxLength={128}
              multiline
              style={styles.messageInput}
            />
            <Text style={styles.messageCount}>{requestMessage.length}/128</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeRequestComposer}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => submitConnectionRequest(null)}
              >
                <Text style={styles.modalSecondaryButtonText}>Send without message</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalPrimaryButton} onPress={() => submitConnectionRequest()}>
              <Text style={styles.modalPrimaryButtonText}>Send request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sharedBioCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <ShieldCheck size={20} color={COLORS.primary} />
              <View style={{ flex: 1, paddingRight: SPACING.md }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.foreground }}>Share bio</Text>
                <Text style={{ fontSize: 12, color: COLORS.mutedForeground, marginTop: 2 }}>
                  Show your bio to accepted connections
                </Text>
              </View>
            </View>
            <Switch
              value={studentData?.share_bio ?? true}
              onValueChange={toggleShareBio}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={{ fontSize: 13, color: COLORS.mutedForeground }} numberOfLines={1} ellipsizeMode="tail">
                Current bio: {studentData?.bio_line || "No bio set"}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                DeviceEventEmitter.emit('openEditProfile');
                router.push("/(tabs)/profile");
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Pencil size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.segmentWrap}>
          {(["matches", "pending", "incoming", "friends"] as SectionKey[]).map((key) => {
            const isActive = activeSection === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                onPress={() => setActiveSection(key)}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {sectionMeta[key].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          {React.createElement(sectionMeta[activeSection].icon, {
            size: 18,
            color: COLORS.primary,
          })}
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>{sectionMeta[activeSection].title}</Text>
            <Text style={styles.sectionSubtitle}>{sectionMeta[activeSection].description}</Text>
          </View>
        </View>

        {activeSection === "matches" && (
          <>
            {loading && !refreshing && !bootstrapping ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : bootstrapping ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.bootstrapText}>Analyzing profiles to calculate your matches...</Text>
              </View>
            ) : (
              <FlatList
                data={matches}
                keyExtractor={(item) => item.peer_id}
                renderItem={renderMatchCard}
                scrollEnabled={false}
                contentContainerStyle={styles.stack}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyListContainer}>
                    <Users size={48} color={COLORS.mutedForeground} style={{ marginBottom: SPACING.md }} />
                    <Text style={styles.emptyTitle}>No Matches Found</Text>
                    <Text style={styles.emptyDescription}>
                      Matches update every day. Try adding more interests to your profile, and check back again tomorrow!
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {activeSection === "pending" && (
          <View style={styles.stack}>
            {outgoingRequests.length > 0 ? (
              outgoingRequests.map((request) => (
                <View key={request.request_id} style={styles.requestCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, styles.avatarSecondary]}>
                      <Text style={styles.avatarText}>{getInitials(request.recipient_name)}</Text>
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.name}>{request.recipient_name}</Text>
                      <Text style={styles.meta}>
                        {request.recipient_major || "Major not set"}
                        {request.recipient_year ? ` • Year ${request.recipient_year}` : ""}
                      </Text>
                    </View>
                    <View style={styles.requestBadge}>
                      <Text style={styles.requestBadgeText}>Sent</Text>
                    </View>
                  </View>

                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Request preview</Text>
                    <Text style={styles.previewText}>
                      {request.request_message?.trim()
                        ? request.request_message
                        : "Sent a connection request without a message."}
                    </Text>
                  </View>

                  <Text style={styles.helperText}>
                    {`Sent ${new Date(request.created_at).toLocaleDateString()}`}
                  </Text>

                  <TouchableOpacity
                    style={[styles.removeButton, { marginTop: SPACING.sm }]}
                    onPress={() => withdrawRequest(request.request_id, request.recipient_id)}
                  >
                    <Text style={styles.removeButtonText}>Withdraw request</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyListContainer}>
                <Clock size={48} color={COLORS.mutedForeground} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptyDescription}>
                  When you send a connection request, it will appear here until it's accepted or declined.
                </Text>
              </View>
            )}
          </View>
        )}

        {activeSection === "incoming" && (
          <View style={styles.stack}>
            {incomingRequests.length > 0 ? (
              incomingRequests.map((request) => (
                <View key={request.request_id} style={styles.requestCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, styles.avatarSecondary]}>
                      <Text style={styles.avatarText}>{getInitials(request.requester_name)}</Text>
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.name}>{request.requester_name}</Text>
                      <Text style={styles.meta}>
                        {request.requester_major || "Major not set"}
                        {request.requester_year ? ` • Year ${request.requester_year}` : ""}
                      </Text>
                    </View>
                    <View style={styles.requestBadge}>
                      <Text style={styles.requestBadgeText}>Incoming</Text>
                    </View>
                  </View>

                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Request preview</Text>
                    <Text style={styles.previewText}>
                      {request.request_message?.trim()
                        ? request.request_message
                        : "Sent a connection request without a message."}
                    </Text>
                  </View>

                  <Text style={styles.helperText}>
                    {`Requested ${new Date(request.created_at).toLocaleDateString()}`}
                  </Text>

                  <View style={styles.incomingActionRow}>
                    <TouchableOpacity
                      style={styles.incomingAcceptButton}
                      onPress={() => acceptIncomingRequest(request.request_id, request.requester_id)}
                    >
                      <Text style={styles.incomingAcceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.incomingIgnoreButton}
                      onPress={() => declineIncomingRequest(request.request_id)}
                    >
                      <Text style={styles.incomingIgnoreButtonText}>Ignore</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyListContainer}>
                <UserPlus size={48} color={COLORS.mutedForeground} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>No incoming requests yet</Text>
                <Text style={styles.emptyDescription}>
                  When someone sends you a connection request, their note will appear here.
                </Text>
              </View>
            )}
          </View>
        )}

        {activeSection === "friends" && (
          <View style={styles.stack}>
            {friends.length > 0 ? (
              friends.map((friend) => (
                <View key={friend.friend_id} style={styles.friendCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, styles.avatarFriend, { overflow: 'hidden' }]}>
                      {friend.avatar_url ? (
                        <Image source={{ uri: friend.avatar_url }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Text style={styles.avatarText}>{getInitials(friend.friend_name)}</Text>
                      )}
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.name}>{friend.friend_name}</Text>
                      <Text style={styles.meta}>
                        {friend.friend_major || "Major not set"}
                        {friend.friend_year ? ` • Year ${friend.friend_year}` : ""}
                      </Text>
                    </View>
                    <View style={styles.friendBadge}>
                      <Text style={styles.friendBadgeText}>Connected</Text>
                    </View>
                  </View>

                  <View style={styles.interestsBlock}>
                    <Text style={styles.blockLabel}>Shared Bio</Text>
                    <View style={styles.detailList}>
                      {friend.bio_line ? (
                        <View style={styles.detailRow}>
                          <View style={styles.detailDot} />
                          <Text style={styles.detailText}>{friend.bio_line}</Text>
                        </View>
                      ) : (
                        <Text style={styles.helperText}>
                          This friend hasn't added a bio yet.
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.friendActionRow}>
                    <TouchableOpacity 
                      style={styles.friendMessageButton} 
                      onPress={() => Alert.alert("Coming Soon", "Direct messaging will be available in a future update.")}
                    >
                      <MessageCircle size={14} color={COLORS.background} />
                      <Text style={styles.friendMessageButtonText}>Message</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.removeButtonInline} onPress={() => removeFriend(friend.friend_id)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyListContainer}>
                <ShieldCheck size={48} color={COLORS.mutedForeground} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyDescription}>
                  Accepted connections will appear here, along with the details they choose to share.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  sharedBioCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sharedBioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sharedBioTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sharedBioTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.foreground,
  },
  sharedBioEditText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  sharedBioDescription: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  sharedBioContent: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sharedBioPlaceholder: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    lineHeight: 20,
  },
  sharedBioText: {
    fontSize: 14,
    color: COLORS.foreground,
    lineHeight: 20,
  },
  segmentWrap: {
    flexDirection: "row",
    gap: 8,
    marginBottom: SPACING.md,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.foreground,
    borderColor: COLORS.foreground,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.mutedForeground,
  },
  segmentTextActive: {
    color: COLORS.background,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: SPACING.md,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.foreground,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.mutedForeground,
    lineHeight: 19,
  },
  stack: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  requestCard: {
    backgroundColor: "rgba(59, 130, 246, 0.06)",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.18)",
    padding: SPACING.lg,
  },
  friendCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  avatarSecondary: {
    backgroundColor: "rgba(59, 130, 246, 0.18)",
  },
  avatarFriend: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
  },
  avatarText: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  cardCopy: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.foreground,
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.mutedForeground,
    lineHeight: 18,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59, 130, 246, 0.10)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  scoreText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  requestBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    borderRadius: RADIUS.xl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  friendBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: RADIUS.xl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  friendBadgeText: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "800",
  },
  interestsBlock: {
    marginTop: SPACING.md,
  },
  blockLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: COLORS.muted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    color: COLORS.foreground,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: SPACING.md,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: COLORS.foreground,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionActive: {
    backgroundColor: COLORS.secondary,
  },
  primaryActionText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "800",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.mutedForeground,
  },
  incomingActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: SPACING.sm,
  },
  incomingAcceptButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  incomingAcceptButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: "800",
  },
  incomingIgnoreButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
  },
  incomingIgnoreButtonText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: "800",
  },
  ignoreButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.muted,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  ignoreButtonText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    fontWeight: "bold",
  },
  previewBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  previewText: {
    fontSize: 13,
    color: COLORS.foreground,
    lineHeight: 19,
  },

  detailList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.foreground,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.foreground,
    marginBottom: SPACING.sm,
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  enableButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  enableButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  emptyListContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.xl,
  },
  bootstrapText: {
    marginTop: SPACING.md,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.mutedForeground,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.foreground,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.mutedForeground,
  },
  modalPeerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  modalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  messageInput: {
    minHeight: 96,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.foreground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    textAlignVertical: "top",
    fontSize: 14,
  },
  messageCount: {
    alignSelf: "flex-end",
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: -4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: SPACING.xs,
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.foreground,
    textAlign: "center",
  },
  modalPrimaryButton: {
    marginTop: 2,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "800",
  },
  removeButton: {
    marginTop: SPACING.md,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
  },
  removeButtonInline: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: "800",
  },
  friendActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: SPACING.md,
  },
  friendMessageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.foreground,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
  },
  friendMessageButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: "800",
  },
});
