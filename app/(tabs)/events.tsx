import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Modal,
  Linking,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../src/components/Theme';
import { Clock, MapPin, Check, Link } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useStudent } from '../../src/data/persona-context';
import { LocationLink } from '../../src/components/LocationLink';

type EventRow = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  tags: string[] | null;
};

type EventCard = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  type: string;
  month: string;
  day: string;
  time: string;
  place: string;
  city: string | null;
  province_state: string | null;
  country: string | null;
  going: number;
  imageUrl: string | null;
  url: string | null;
  tags: string[] | null;
};

type FriendGoing = {
  friend_id: string;
  friend_name: string;
  friend_major: string;
  friend_year: number | null;
};

const CATEGORY_COLORS: Record<string, { background: string; text: string }> = {
  Academic:      { background: COLORS.emerald, text: COLORS.emeraldText },
  Social:        { background: COLORS.primary, text: COLORS.primaryForeground },
  Wellness:      { background: COLORS.rose,    text: COLORS.roseText },
  Career:        { background: COLORS.amber,   text: COLORS.amberText },
  Volunteering:  { background: COLORS.muted,   text: COLORS.foreground },
  Athletics:     { background: COLORS.muted,   text: COLORS.foreground },
  International: { background: COLORS.muted,   text: COLORS.foreground },
  Financial:     { background: COLORS.muted,   text: COLORS.foreground },
  Arts:          { background: COLORS.muted,   text: COLORS.foreground },
  Technology:    { background: COLORS.muted,   text: COLORS.foreground },
};

function CategoryTag({ type }: { type: string }) {
  const palette = CATEGORY_COLORS[type] || { background: COLORS.muted, text: COLORS.foreground };
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <Text style={[styles.tagText, { color: palette.text }]}>{type}</Text>
    </View>
  );
}

function formatEventCard(row: EventRow): EventCard | null {
  if (!row.start_time) return null;
  const start = new Date(row.start_time);
  if (Number.isNaN(start.getTime())) return null;

  const end = row.end_time ? new Date(row.end_time) : null;
  
  const hasStartTime = start.getHours() !== 0 || start.getMinutes() !== 0;
  const hasEndTime = end ? (end.getHours() !== 0 || end.getMinutes() !== 0) : false;
  
  const now = new Date();
  if (end) {
    if (hasEndTime) {
      if (now > end) return null;
    } else {
      const endLimit = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      if (now > endLimit) return null;
    }
  } else {
    const startLimit = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    if (now > startLimit) return null;
  }

  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start);
  const day   = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(start);
  const formatDatePart = (d: Date): string => {
    const m = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
    const dy = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(d);
    const currentYear = new Date().getFullYear();
    if (d.getFullYear() !== currentYear) {
      return `${m} ${dy}, ${d.getFullYear()}`;
    }
    return `${m} ${dy}`;
  };

  const formatTimePart = (d: Date): string => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  };

  const isMultiDay = end ? (start.toDateString() !== end.toDateString()) : false;

  let time = "";
  if (isMultiDay && end) {
    const startDateStr = formatDatePart(start);
    const endDateStr = formatDatePart(end);
    if (hasStartTime && hasEndTime) {
      time = `${startDateStr}, ${formatTimePart(start)} – ${endDateStr}, ${formatTimePart(end)}`;
    } else if (hasStartTime && !hasEndTime) {
      time = `${startDateStr}, ${formatTimePart(start)} – ${endDateStr}`;
    } else if (!hasStartTime && hasEndTime) {
      time = `${startDateStr} – ${endDateStr}, ${formatTimePart(end)}`;
    } else {
      time = `${startDateStr} – ${endDateStr}`;
    }
  } else {
    const dateStr = formatDatePart(start);
    if (hasStartTime && hasEndTime && end) {
      time = `${dateStr}, ${formatTimePart(start)} – ${formatTimePart(end)}`;
    } else if (hasStartTime) {
      time = `${dateStr}, ${formatTimePart(start)}`;
    } else {
      time = dateStr;
    }
  }

  const type = row.tags?.[0] || 'Academic';

  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    type,
    month,
    day,
    time,
    place: row.location || 'NorQuest / SANQC',
    city: row.city,
    province_state: row.province_state,
    country: row.country,
    going: 0,
    imageUrl: row.image_url,
    url: row.url,
    tags: row.tags ?? null,
  };
}

// ─── Segmented control ───────────────────────────────────────────────────────
function SegmentedControl({
  value,
  onChange,
}: {
  value: 'my' | 'all';
  onChange: (v: 'my' | 'all') => void;
}) {
  // Animated indicator position: 0 = My Interests, 1 = All
  const anim = useRef(new Animated.Value(value === 'my' ? 0 : 1)).current;

  // Sync animated position when value changes externally
  useEffect(() => {
    slide(value === 'my' ? 0 : 1);
  }, [value]);

  const slide = (to: number) => {
    Animated.timing(anim, {
      toValue: to,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handlePress = (mode: 'my' | 'all') => {
    onChange(mode);
  };

  // Interpolate left offset for the sliding pill
  const indicatorLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '51%'],
  });

  return (
    <View style={styles.segmentTrack}>
      {/* Animated sliding pill */}
      <Animated.View style={[styles.segmentPill, { left: indicatorLeft }]} />

      <Pressable
        style={styles.segmentSide}
        onPress={() => handlePress('my')}
        android_ripple={{ color: 'transparent' }}
      >
        <Text style={[styles.segmentLabel, value === 'my' && styles.segmentLabelActive]}>
          My Interests
        </Text>
      </Pressable>

      <Pressable
        style={styles.segmentSide}
        onPress={() => handlePress('all')}
        android_ripple={{ color: 'transparent' }}
      >
        <Text style={[styles.segmentLabel, value === 'all' && styles.segmentLabelActive]}>
          All Events
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Category pill ────────────────────────────────────────────────────────────
function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterPill, active && styles.filterPillActive]}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Tag row component that shows tags in a single line and adds a '+' overflow pill
function TagRow({ tags }: { tags: string[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [pillWidths, setPillWidths] = useState<Record<string, number>>({});

  // Compute which tags fit based on measured widths
  const visibleTags = useMemo(() => {
    // If we don't yet know container width, show all tags (avoid empty rendering)
    if (containerWidth === 0) return tags;
    const result: string[] = [];
    let used = 0;
    for (const t of tags) {
      const w = (pillWidths[t] ?? 0) + 4; // add marginRight spacing
      if (used + w <= containerWidth) {
        result.push(t);
        used += w;
      } else {
        break;
      }
    }
    return result;
  }, [tags, pillWidths, containerWidth]);
  const overflowCount = tags.length - visibleTags.length;

  return (
    <View
      style={styles.tagsRow}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {visibleTags.map((t) => (
        <TagPill
          key={t}
          label={t}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            setPillWidths(prev => ({ ...prev, [t]: width }));
          }}
        />
      ))}
      {overflowCount > 0 && <TagPill label={`+${overflowCount}`} />}
    </View>
  );
}

// Tag pill for event tags (non‑interactive)
function TagPill({ label, onLayout, style }: { label: string; onLayout?: (e: any) => void; style?: any }) {
  return (
    <View style={[styles.eventTagPill, style]} onLayout={onLayout}>
      <Text style={styles.eventTagPillText}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EventsScreen({ onProfileClick }: { onProfileClick?: () => void }) {
  const { studentData, allInterests } = useStudent();
  const [allEvents, setAllEvents] = useState<EventCard[]>([]);
  const [friendGoingByEvent, setFriendGoingByEvent] = useState<Record<string, FriendGoing[]>>({});
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [filter, setFilter] = useState('All');
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<(EventCard & { description: string | null; friendGoing: FriendGoing[] }) | null>(null);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const handleCloseModal = () => {
    setSelectedEvent(null);
    setActiveTooltipId(null);
    setDescriptionExpanded(false);
  };

  const initializedRef = useRef(false);
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);

  useEffect(() => {
    if (studentData && !initializedRef.current) {
      const hasInterests = Array.isArray(studentData.interests) && studentData.interests.length > 0;
      setViewMode(hasInterests ? 'my' : 'all');
      initializedRef.current = true;
    }
  }, [studentData]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Preserve scroll position of category filter
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryScrollX = useRef(0);

  // Restore scroll position after filter changes to avoid jitter
  useEffect(() => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollTo({ x: categoryScrollX.current, animated: false });
    }
  }, [filter]);
  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      // Fetch events (limit for demo, can be increased later)
      const { data: eventsData, error: queryError } = await supabase
        .from('events')
        .select('id,source,title,description,url,image_url,start_time,end_time,location,city,province_state,country,tags')
        .order('start_time', { ascending: true })
        .limit(100);

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setAllEvents([]);
        setLoading(false);
        return;
      }

      // Map raw rows to UI cards
      const mapped = (eventsData ?? [])
        .map((row) => formatEventCard(row as EventRow))
        .filter((item): item is EventCard => item !== null);

      // Fetch RSVP counts for the loaded events
      const eventIds = mapped.map((e) => e.id);
      const { data: attendees } = await supabase
        .from('event_rsvps')
        .select('event_id, student_id')
        .in('event_id', eventIds);
        
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      
      const counts: Record<string, number> = {};
      const attendeeIdsByEvent: Record<string, string[]> = {};
      const initialRsvps = new Set<string>();
      
      attendees?.forEach((a) => {
        const eid = a.event_id as string;
        const sid = a.student_id as string;
        counts[eid] = (counts[eid] ?? 0) + 1;
        if (!attendeeIdsByEvent[eid]) attendeeIdsByEvent[eid] = [];
        attendeeIdsByEvent[eid].push(sid);
        if (sid === currentUserId) initialRsvps.add(eid);
      });
      setRsvps(initialRsvps);

      const { data: friendsData } = await supabase.rpc('get_friend_connections');
      const friendMap = new Map<string, FriendGoing>();
      (friendsData ?? []).forEach((friend: any) => {
        friendMap.set(friend.friend_id, {
          friend_id: friend.friend_id,
          friend_name: friend.friend_name,
          friend_major: friend.friend_major,
          friend_year: friend.friend_year,
        });
      });

      const friendsByEvent: Record<string, FriendGoing[]> = {};
      Object.entries(attendeeIdsByEvent).forEach(([eventId, attendeeIds]) => {
        friendsByEvent[eventId] = attendeeIds
          .map((studentId) => friendMap.get(studentId))
          .filter((friend): friend is FriendGoing => Boolean(friend));
      });

      // Attach counts to each event card
      const enriched = mapped.map((e) => ({ ...e, going: counts[e.id] ?? 0 }));

      setAllEvents(enriched);
      setFriendGoingByEvent(friendsByEvent);
      setLoading(false);
    };
    loadEvents();
    return () => { cancelled = true; };
  }, []);

  const interestLabels = useMemo(() => {
    const interests = studentData?.interests;
    if (!Array.isArray(interests)) return [];
    try {
      return interests
        .map((i) => {
          if (!i || typeof i.interest !== 'string') return '';
          const parts = i.interest.split(': ');
          return parts[1] || i.interest;
        })
        .filter(Boolean);
    } catch (e) {
      console.error("Failed to parse interests:", e);
      return [];
    }
  }, [studentData?.interests]);

  const displayedEvents = useMemo(() => {
    if (viewMode === 'my') {
      const set = new Set(interestLabels);
      return allEvents.filter((e) => e.tags?.some((t) => set.has(t)));
    }
    return allEvents;
  }, [viewMode, interestLabels, allEvents]);

  const sources = ['All', 'NorQuest', 'SANQC'];

  const filtered = useMemo(() => {
    if (filter === 'All') return displayedEvents;
    return displayedEvents.filter((e) => {
       const isSanqcEvent = /^SANQC\b/i.test(e.title.trim());
       if (filter === 'NorQuest') return !isSanqcEvent;
       if (filter === 'SANQC') return isSanqcEvent;
       return true;
    });
  }, [filter, displayedEvents]);

  useEffect(() => {
    if (!loading && viewMode === 'my' && !hasAutoSwitched) {
      if (filtered.length === 0) {
        setViewMode('all');
      }
      setHasAutoSwitched(true);
    }
  }, [loading, viewMode, filtered, hasAutoSwitched]);

  const renderEvent = ({ item }: { item: EventCard }) => {
    const isGoing = rsvps.has(item.id);
    const tags = item.tags ?? [];
    const goingCount = item.going ?? 0;
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setSelectedEvent({ ...item, friendGoing: friendGoingByEvent[item.id] ?? [] })}
        style={styles.card}
      >
        <View style={styles.dateBadge}>
          <Text style={styles.month}>{item.month}</Text>
          <Text style={styles.day}>{item.day}</Text>
        </View>
        <View style={styles.content}>
          
          {tags.length > 0 && <TagRow tags={tags} />}
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.row}>
            <Clock size={12} color={COLORS.mutedForeground} />
            <Text style={styles.meta}>{item.time}</Text>
          </View>
          <View style={styles.row}>
            <MapPin size={12} color={COLORS.mutedForeground} />
            <LocationLink
              location={item.place}
              city={item.city}
              province_state={item.province_state}
              country={item.country}
              style={styles.meta}
            />
          </View>
          {item.url && (
            <View style={styles.row}>
              <Link size={12} color={COLORS.mutedForeground} />
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL(item.url!)}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.url.length > 64 ? `${item.url.slice(0, 64)}...` : item.url}
              </Text>
            </View>
          )}
          <View style={styles.footer}>
            <View style={styles.goingInfo}>
              <View style={styles.avatarStack}>
                {[...Array(3)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.avatar,
                      { backgroundColor: `hsl(${210 + i * 20},70%,60%)`, left: i ? -6 : 0 },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.goingCopy}>
                <Text style={styles.goingText}>+{goingCount} going</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user?.id;
                if (!userId) return;
                const isGoingNow = !isGoing;
                const next = new Set(rsvps);
                if (isGoing) next.delete(item.id);
                else next.add(item.id);
                setRsvps(next);
                setAllEvents((prev) => prev.map(e => e.id === item.id ? { ...e, going: isGoing ? Math.max(e.going - 1, 0) : e.going + 1 } : e));

                if (isGoing) {
                  // Delete RSVP
                  const { error } = await supabase.from('event_rsvps').delete().eq('event_id', item.id).eq('student_id', userId);
                  if (error) {
                     console.error("Failed to delete RSVP:", error);
                     alert("Could not remove RSVP. Please try again.");
                     setRsvps(new Set(rsvps)); // Revert
                     setAllEvents((prev) => prev.map(e => e.id === item.id ? { ...e, going: item.going } : e));
                  }
                } else {
                  // Insert RSVP
                  const { error } = await supabase.from('event_rsvps').insert({ event_id: item.id, student_id: userId });
                  if (error) {
                     console.error("Failed to add RSVP:", error);
                     alert("Could not RSVP. Please try again.");
                     setRsvps(new Set(rsvps)); // Revert
                     setAllEvents((prev) => prev.map(e => e.id === item.id ? { ...e, going: item.going } : e));
                  }
                }
              }}
              style={[
                styles.rsvpBtn,
                isGoing ? styles.rsvpGoing : styles.rsvpNotGoing,
                { borderColor: isGoing ? 'transparent' : COLORS.primary },
              ]}
            >
              {isGoing && <Check size={14} color={COLORS.emeraldText} />}
              <Text style={[styles.rsvpText, { color: isGoing ? COLORS.emeraldText : COLORS.primary }]}>
                {isGoing ? 'Going' : "I'm Going"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.container}>
      <View style={styles.headerSpacer} />
      {!studentData ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Sign in to see your events</Text>
          <Text style={styles.stateText}>Events are filtered by the interests saved on your profile.</Text>
        </View>
      ) : loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Could not load events</Text>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : (
        <>
          <Modal
            visible={selectedEvent !== null}
            transparent
            animationType="slide"
            onRequestClose={handleCloseModal}
          >
            <View style={styles.modalBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handleCloseModal}
              />
              <View style={styles.detailSheet}>
                    {selectedEvent && (
                      <>
                        <View style={styles.detailHeader}>
                          <View style={styles.detailDateBadge}>
                            <Text style={styles.month}>{selectedEvent.month}</Text>
                            <Text style={styles.day}>{selectedEvent.day}</Text>
                          </View>
                          <View style={styles.detailHeaderCopy}>
                            <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                            <View style={styles.row}>
                              <Clock size={12} color={COLORS.mutedForeground} />
                              <Text style={styles.meta}>{selectedEvent.time}</Text>
                            </View>
                            <View style={styles.row}>
                              <MapPin size={12} color={COLORS.mutedForeground} />
                              <LocationLink
                                location={selectedEvent.place}
                                city={selectedEvent.city}
                                province_state={selectedEvent.province_state}
                                country={selectedEvent.country}
                                style={styles.meta}
                              />
                            </View>
                            {selectedEvent.url && (
                              <View style={styles.row}>
                                <Link size={12} color={COLORS.mutedForeground} />
                                <Text
                                  style={styles.linkText}
                                  onPress={() => Linking.openURL(selectedEvent.url!)}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {selectedEvent.url.length > 64 ? `${selectedEvent.url.slice(0, 64)}...` : selectedEvent.url}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailBody}>
                          {selectedEvent.tags?.length ? (
                            <View style={styles.detailSection}>
                              <Text style={styles.sectionLabel}>Tags</Text>
                              <View style={styles.tagsRow}>
                                {selectedEvent.tags.map((tag) => <TagPill key={tag} label={tag} />)}
                              </View>
                            </View>
                          ) : null}

                          <View style={styles.detailSection}>
                            <Text style={styles.sectionLabel}>About this event</Text>
                            <Text style={styles.descriptionText}>
                              {selectedEvent.description 
                                ? (descriptionExpanded || selectedEvent.description.length <= 180 ? (
                                    selectedEvent.description
                                  ) : (
                                    <Text>
                                      {selectedEvent.description.slice(0, 180)}...{" "}
                                      <Text 
                                        style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }} 
                                        onPress={() => setDescriptionExpanded(true)}
                                      >
                                        Read more
                                      </Text>
                                    </Text>
                                  ))
                                : 'No description is available for this event.'}
                            </Text>
                            {selectedEvent.description && selectedEvent.description.length > 180 && descriptionExpanded && (
                              <TouchableOpacity 
                                onPress={() => setDescriptionExpanded(false)} 
                                style={{ marginTop: 6, paddingVertical: 4 }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                                  Read less
                                </Text>
                              </TouchableOpacity>
                            )}

                          </View>

                          <View style={styles.detailSection}>
                            <Text style={styles.sectionLabel}>People going</Text>
                            <View style={styles.modalGoingRow}>
                              <View style={styles.avatarStack}>
                                {[...Array(3)].map((_, i) => (
                                  <View
                                    key={i}
                                    style={[
                                      styles.avatar,
                                      { backgroundColor: `hsl(${210 + i * 20},70%,60%)`, left: i ? -6 : 0 },
                                    ]}
                                    />
                                  ))}
                              </View>
                              <Text style={styles.goingText}>+{selectedEvent.going} going</Text>
                            </View>
                            {selectedEvent.friendGoing.length > 0 ? (
                              <View style={[styles.friendList, { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }]}>
                                {selectedEvent.friendGoing.map((friend) => (
                                  <View key={friend.friend_id} style={{ position: 'relative', zIndex: activeTooltipId === friend.friend_id ? 10 : 1 }}>
                                    <TouchableOpacity 
                                      activeOpacity={0.8}
                                      onPress={() => setActiveTooltipId(prev => prev === friend.friend_id ? null : friend.friend_id)}
                                      style={styles.friendAvatar}
                                    >
                                      <Text style={styles.friendAvatarText}>
                                        {friend.friend_name.split(' ').map((n) => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                                      </Text>
                                    </TouchableOpacity>
                                    {activeTooltipId === friend.friend_id && (
                                      <View style={styles.tooltipContainer}>
                                        <Text style={styles.tooltipText}>{friend.friend_name}</Text>
                                      </View>
                                    )}
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.friendEmpty}>None of your friends have RSVP'd yet.</Text>
                            )}
                          </View>

                          <View style={styles.footerButtonRow}>
                            <View style={styles.footerButtonPair}>
                              <TouchableOpacity
                                style={[
                                  styles.popupActionButton,
                                  rsvps.has(selectedEvent.id) ? styles.rsvpGoing : styles.rsvpNotGoing,
                                  { borderColor: rsvps.has(selectedEvent.id) ? 'transparent' : COLORS.primary },
                                ]}
                                onPress={async () => {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const userId = session?.user?.id;
                                  if (!userId) return;
                                  const isGoing = rsvps.has(selectedEvent.id);
                                  const next = new Set(rsvps);
                                  if (isGoing) next.delete(selectedEvent.id);
                                  else next.add(selectedEvent.id);
                                  setRsvps(next);
                                  setSelectedEvent((prev) => prev ? { ...prev, going: isGoing ? Math.max(prev.going - 1, 0) : prev.going + 1 } : prev);
                                  setAllEvents((prev) => prev.map(e => e.id === selectedEvent.id ? { ...e, going: isGoing ? Math.max(e.going - 1, 0) : e.going + 1 } : e));

                                  if (isGoing) {
                                    const { error } = await supabase.from('event_rsvps').delete().eq('event_id', selectedEvent.id).eq('student_id', userId);
                                    if (error) {
                                      console.error("Failed to delete RSVP:", error);
                                      alert("Could not remove RSVP. Please try again.");
                                      setRsvps(new Set(rsvps));
                                      setSelectedEvent((prev) => prev ? { ...prev, going: selectedEvent.going } : prev);
                                      setAllEvents((prev) => prev.map(e => e.id === selectedEvent.id ? { ...e, going: selectedEvent.going } : e));
                                    }
                                  } else {
                                    const { error } = await supabase.from('event_rsvps').insert({ event_id: selectedEvent.id, student_id: userId });
                                    if (error) {
                                      console.error("Failed to add RSVP:", error);
                                      alert("Could not RSVP. Please try again.");
                                      setRsvps(new Set(rsvps));
                                      setSelectedEvent((prev) => prev ? { ...prev, going: selectedEvent.going } : prev);
                                      setAllEvents((prev) => prev.map(e => e.id === selectedEvent.id ? { ...e, going: selectedEvent.going } : e));
                                    }
                                  }
                                }}
                                activeOpacity={0.85}
                              >
                                {rsvps.has(selectedEvent.id) && <Check size={14} color={COLORS.emeraldText} />}
                                <Text style={[styles.rsvpText, { color: rsvps.has(selectedEvent.id) ? COLORS.emeraldText : COLORS.primary }]}>
                                  {rsvps.has(selectedEvent.id) ? 'Going' : "I'm Going"}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.modalSecondaryButton}
                                onPress={handleCloseModal}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.modalSecondaryButtonText}>Close</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </ScrollView>
                      </>
                    )}
                  </View>
              </View>
          </Modal>
          <View style={styles.intro}>
            <Text style={styles.heading}>Campus Events</Text>
            <Text style={styles.subheading}>Discover what's happening at NorQuest and SANQC.</Text>
          </View>
          <View style={styles.segmentWrapper}>
            <SegmentedControl value={viewMode} onChange={setViewMode} />
          </View>
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={e => { categoryScrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
            style={styles.categoryBar}
            contentContainerStyle={styles.categoryContainer}
          >
            {sources.map((src) => (
              <FilterPill
                key={src}
                label={src}
                active={filter === src}
                onPress={() => setFilter(src)}
              />
            ))}
          </ScrollView>
          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            renderItem={renderEvent}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={() => (
              <View style={styles.stateContainer}>
                <Text style={styles.stateTitle}>No events found</Text>
                <Text style={styles.stateText}>No upcoming events matched the current filter.</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSpacer: {
    height: 40,
  },

  // ── State screens
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.foreground,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },

  // ── Header text
  intro: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.foreground,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },

  // ── Segmented control
  segmentWrapper: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.md,
    padding: 3,
    position: 'relative',
    height: 40,
    overflow: 'hidden',
  },
  segmentPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '48%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    // subtle shadow on Android
    elevation: 2,
  },
  segmentSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  segmentLabelActive: {
    color: COLORS.primaryForeground,
  },

  // ── Category filter pills
  categoryBar: {
    marginBottom: SPACING.sm,
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryContainer: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: COLORS.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  filterPillTextActive: {
    color: COLORS.primaryForeground,
    fontWeight: '500',
  },

  // ── Event list
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailHeader: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailDateBadge: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderCopy: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.foreground,
    letterSpacing: -0.3,
  },
  detailMeta: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  detailBody: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  detailSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.foreground,
  },
  descriptionCta: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.mutedForeground,
    marginTop: 6,
    fontWeight: '600',
  },
  friendList: {
    gap: 10,
    marginTop: 4,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.md,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: COLORS.primaryForeground,
    fontSize: 12,
    fontWeight: '800',
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.foreground,
  },
  friendMeta: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  friendEmpty: {
    fontSize: 13,
    color: COLORS.mutedForeground,
  },
  footerButtonRow: {
    gap: 10,
    marginTop: SPACING.xs,
  },
  footerButtonPair: {
    flexDirection: 'row',
    gap: 10,
  },
  popupActionButton: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rsvpFooterButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  footerPlaceholder: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  closeFooterWide: {
    width: '100%',
  },
  modalSecondaryButton: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
  },
  modalSecondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.foreground,
  },
  dateBadge: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  month: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.mutedForeground,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  day: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.foreground,
  },
  content: {
    flex: 1,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Event tag pill styling (used for multiple tags)
  eventTagPill: {
    backgroundColor: COLORS.muted,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  eventTagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap', // prevent wrapping to new line
    overflow: 'hidden', // clip any overflow
    marginTop: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.foreground,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginLeft: 4,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  goingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goingCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 4,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    position: 'relative',
  },
  goingText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  modalGoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    marginTop: 2,
  },
  inlineRsvpButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineRsvpButtonText: {
    color: COLORS.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  rsvpGoing: {
    backgroundColor: COLORS.emerald,
  },
  rsvpNotGoing: {
    backgroundColor: COLORS.background,
  },
  rsvpText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tooltipContainer: {
    position: 'absolute',
    bottom: -32,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: COLORS.foreground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
    minWidth: 80,
    alignItems: 'center',
  },
  tooltipText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

