import { 
  GraduationCap, 
  BookOpen, 
  Heart, 
  ChevronRight,
  User,
  Calendar,
  X,
  Plus,
  Search,
  ChevronLeft,
  LogOut,
  Compass,
  Upload,
  Sparkles,
  Image as LucideImage
} from "lucide-react-native";
import { supabase } from "../../src/lib/supabase";
import { useRouter } from "expo-router";
import { useStudent } from "../../src/data/persona-context";
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  ActivityIndicator,
  ScrollView,
  Alert,
  DeviceEventEmitter,
  Switch,
  Image,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";

type EditMode = "none" | "profile" | "year" | "major" | "courses" | "interests" | "logout";

const groupInterestsByCategory = (interests: { id: string; interest: string }[]) => {
  const grouped: Record<string, { id: string; interest: string; displayName: string }[]> = {};
  interests.forEach((item) => {
    const parts = item.interest.split(": ");
    const category = parts[0] || "General";
    const name = parts[1] || item.interest;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({
      ...item,
      displayName: name,
    });
  });
  return grouped;
};

export default function ProfileScreen() {
  const { studentData, preloadedMajors, preloadedCourses, allInterests, loading: globalLoading, refreshData, updateStudentData } = useStudent();
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [saving, setSaveLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('resetProfileView', () => setEditMode("none"));
    const editSub = DeviceEventEmitter.addListener('openEditProfile', () => setEditMode("profile"));
    return () => {
      sub.remove();
      editSub.remove();
    };
  }, []);

  const [scheduleImage, setScheduleImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load schedule image on mount/context update
  useEffect(() => {
    if (studentData?.schedule_image) {
      setScheduleImage(studentData.schedule_image);
      AsyncStorage.setItem("student_schedule_image", studentData.schedule_image).catch(err => 
        console.error("Failed caching schedule image:", err)
      );
    } else {
      AsyncStorage.getItem("student_schedule_image").then(stored => {
        if (stored) setScheduleImage(stored);
      }).catch(err => console.error("Failed loading cached image:", err));
    }
  }, [studentData?.schedule_image]);

  const handleUploadSchedule = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a schedule.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    setUploadingImage(true);

    try {
      const base64Data = `data:image/jpeg;base64,${asset.base64}`;
      
      // Save locally to AsyncStorage
      await AsyncStorage.setItem("student_schedule_image", base64Data);
      setScheduleImage(base64Data);

      // Save to Supabase database if logged in
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { error } = await supabase
          .from("students")
          .update({ schedule_image: base64Data })
          .eq("id", user.id);
        
        if (error) {
          console.error("Database save failed:", error.message);
        } else {
          if (refreshData) refreshData();
        }
      }


    } catch (err: any) {
      console.error("Error saving schedule image:", err);
      Alert.alert("Error", "Failed to process and upload schedule image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveSchedule = async () => {
    try {
      await AsyncStorage.removeItem("student_schedule_image");
      setScheduleImage(null);

      // Remove from Supabase database
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { error } = await supabase
          .from("students")
          .update({ schedule_image: null })
          .eq("id", user.id);
        
        if (error) {
          console.error("Database removal failed:", error.message);
        } else {
          if (refreshData) refreshData();
        }
      }
    } catch (err) {
      console.error("Error removing schedule image:", err);
    }
  };

  const handleUploadAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.6,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        Alert.alert("Error", "You must be logged in to change your profile picture.");
        return;
      }

      setSaveLoading(true);

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Upload file to bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
    } catch (err: any) {
      console.error("Error setting profile image:", err);
      Alert.alert("Error", `Failed to upload profile image: ${err.message || err}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar_url: null }));
  };

  const [formData, setFormData] = useState({
    name: "",
    year: null as number | null,
    major: "",
    school: "",
    matching_enabled: true,
    courses: [] as { id: string, course: string }[],
    interests: [] as { id: string, interest: string }[],
    bio_line: "",
    avatar_url: null as string | null,
  });

  // Sync internal form data with global student data from context
  useEffect(() => {
    if (studentData) {
      setFormData({
        name: studentData.name,
        school: studentData.school,
        year: studentData.year,
        major: studentData.major,
        matching_enabled: studentData.matching_enabled,
        courses: studentData.courses,
        interests: studentData.interests,
        bio_line: studentData.bio_line || "",
        avatar_url: studentData.avatar_url || null,
      });
    }
  }, [studentData]);

  // Suggestion states
  const [majorSuggestions, setMajorSuggestions] = useState<string[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState<{id: string, course: string}[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Local Major search (using preloaded data first)
  useEffect(() => {
    if (editMode !== "major" || formData.major.length < 2) {
      setMajorSuggestions([]);
      return;
    }

    const trimmed = formData.major.toLowerCase();
    const localMatches = preloadedMajors.filter(m => m.toLowerCase().includes(trimmed)).slice(0, 5);
    setMajorSuggestions(localMatches);

    if (localMatches.length < 3) {
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from('majors')
          .select('major')
          .eq('school', formData.school)
          .ilike('major', `%${formData.major}%`)
          .limit(5);
        if (data) {
          const fetched = data.map(d => d.major);
          setMajorSuggestions(prev => Array.from(new Set([...prev, ...fetched])));
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.major, editMode, preloadedMajors]);

  // Local Course search (using preloaded data first)
  useEffect(() => {
    if (editMode !== "courses" || courseInput.length < 2) {
      setCourseSuggestions([]);
      setLoadingCourses(false);
      return;
    }

    const trimmed = courseInput.toLowerCase();
    const localMatches = preloadedCourses.filter(c => c.course.toLowerCase().includes(trimmed)).slice(0, 5);
    setCourseSuggestions(localMatches);

    if (localMatches.length < 3) {
      setLoadingCourses(true);
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from('courses')
          .select('id, course')
          .eq('school', formData.school)
          .ilike('course', `%${courseInput}%`)
          .limit(5);
        if (data) {
          setCourseSuggestions(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNew = data.filter(d => !existingIds.has(d.id));
            return [...prev, ...uniqueNew].slice(0, 5);
          });
        }
        setLoadingCourses(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [courseInput, editMode, preloadedCourses]);

  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const validateCourseFormat = (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length > 64) return false;
    const regex = /^[A-Z]{2,}\s\d{3}$/;
    return regex.test(trimmed.toUpperCase());
  };

  const saveProfileUpdate = (updateData: any) => {
    // 1. Optimistically update context immediately
    updateStudentData(updateData);
    
    // 2. Instantly exit edit mode
    setEditMode("none");

    // 3. Save to database in the background concurrently
    const syncDatabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let { error } = await supabase
            .from('students')
            .update(updateData)
            .eq('id', user.id);
          
          if (error && (error.message.includes("avatar_url") || error.message.includes("share_bio") || error.message.includes("column"))) {
            console.warn("Profile update failed due to missing columns, retrying with base columns...");
            const baseUpdate = { ...updateData };
            delete baseUpdate.avatar_url;
            delete baseUpdate.share_bio;
            delete baseUpdate.bio_line; // bio_line might exist, but let's be safe if it doesn't
            
            const retry = await supabase
              .from('students')
              .update(baseUpdate)
              .eq('id', user.id);
            error = retry.error;
          }
          
          if (error) {
            console.error("Failed background profile update:", error.message);
          } else {
            refreshData();
            DeviceEventEmitter.emit('profileUpdated');
          }
        }
      } catch (err: any) {
        console.error("Error in background profile update sync:", err.message);
      }
    };
    syncDatabase();
  };

  const saveMajor = () => {
    const formattedMajor = toTitleCase(formData.major.trim());
    
    // 1. Optimistically update context immediately
    updateStudentData({ major: formattedMajor });
    
    // 2. Instantly exit edit mode
    setEditMode("none");

    // 3. Save to database in the background concurrently
    const syncDatabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: newMajorId, error: rpcError } = await supabase.rpc('add_major_if_not_exists', {
            p_school: formData.school,
            p_major: formattedMajor
          });

          if (rpcError) {
            console.error("Failed to add major:", rpcError);
            Alert.alert("Error", "Could not process the major.");
            return;
          }

          if (newMajorId) {
            const { error } = await supabase.from('students').update({ major_id: newMajorId }).eq('id', user.id);
            if (error) {
              console.error("Failed background major update:", error.message);
            } else {
              refreshData();
              DeviceEventEmitter.emit('profileUpdated');
            }
          }
        }
      } catch (err: any) {
        console.error("Error in background major sync:", err.message);
      }
    };
    syncDatabase();
  };

  const addNewCourse = async (courseName: string) => {
    const cleanName = courseName.trim().toUpperCase();
    if (!cleanName || !validateCourseFormat(cleanName)) return;

    if (formData.courses.length >= 7) {
      Alert.alert("Course Limit Reached", "You can only enroll in up to 7 classes at a time.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      courses: [...prev.courses, { id: tempId, course: cleanName }]
    }));
    setCourseInput("");

    const processAddition = async () => {
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('school', formData.school)
        .eq('course', cleanName)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('student_courses').upsert({
          student_id: user.id,
          course_id: existing.id
        });
        
        if (error) {
          Alert.alert("Error", "Failed to link course. Reverting...");
          refreshData();
        } else {
          refreshData();
          DeviceEventEmitter.emit('profileUpdated');
        }
      } else {
        Alert.alert(
          "Course not found",
          "Please choose an existing course from the suggestions. New courses can no longer be created from the app."
        );
        refreshData();
      }
    };
    processAddition();
  };

  const addCourse = async (course: {id: string, course: string}) => {
    if (formData.courses.length >= 7) {
      Alert.alert("Course Limit Reached", "You can only enroll in up to 7 classes at a time.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setFormData(prev => ({
        ...prev,
        courses: [...prev.courses, course]
      }));
      setCourseInput("");

      const { error } = await supabase.from('student_courses').upsert({
        student_id: user.id,
        course_id: course.id
      });

      if (error) {
        Alert.alert("Error", "Failed to add course. Please try again.");
        refreshData();
      } else {
        refreshData();
        DeviceEventEmitter.emit('profileUpdated');
      }
    }
  };

  const removeCourse = async (courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setFormData(prev => ({
        ...prev,
        courses: prev.courses.filter(c => c.id !== courseId)
      }));

      const { error } = await supabase.from('student_courses')
        .delete()
        .eq('student_id', user.id)
        .eq('course_id', courseId);

      if (error) {
        Alert.alert("Error", "Failed to remove course. Please try again.");
        refreshData();
      } else {
        refreshData();
        DeviceEventEmitter.emit('profileUpdated');
      }
    }
  };

  const toggleInterest = async (interest: {id: string, interest: string}) => {
    const isSelected = formData.interests.some(i => i.id === interest.id);
    
    // Optimistic UI update
    const newInterests = isSelected
      ? formData.interests.filter(i => i.id !== interest.id)
      : [...formData.interests, interest];
      
    setFormData(prev => ({ ...prev, interests: newInterests }));
    updateStudentData({ interests: newInterests });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isSelected) {
      await supabase.from('student_interests')
        .delete()
        .eq('student_id', user.id)
        .eq('interest_id', interest.id);
    } else {
      await supabase.from('student_interests')
        .insert({ student_id: user.id, interest_id: interest.id });
    }
    
    refreshData();
    DeviceEventEmitter.emit('profileUpdated');
  };

  const saveInterests = () => {
    setEditMode("none");
  };

  const toggleDiscoveryMode = (value: boolean) => {
    // 1. Optimistically update local form state
    setFormData(prev => ({ ...prev, matching_enabled: value }));

    // 2. Optimistically update global student context
    updateStudentData({ matching_enabled: value });

    // 3. Update database in background concurrently
    const syncDatabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('students')
            .update({ matching_enabled: value })
            .eq('id', user.id);
          
          if (error) {
            console.error("Failed to update discovery mode:", error.message);
            // Revert state on error
            setFormData(prev => ({ ...prev, matching_enabled: !value }));
            updateStudentData({ matching_enabled: !value });
            Alert.alert("Error", "Failed to update discovery settings.");
          } else {
            refreshData();
            DeviceEventEmitter.emit('profileUpdated');
          }
        }
      } catch (err: any) {
        console.error("Error in toggle discovery sync:", err.message);
      }
    };
    syncDatabase();
  };

  const renderEditContent = () => {
    switch (editMode) {
      case "profile":
        return (
          <View key="profile" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setEditMode("none")}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Edit Profile</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Profile Photo Section */}
            <View style={{ alignItems: "center", marginBottom: SPACING.lg }}>
              <View style={styles.avatarLarge}>
                {formData.avatar_url ? (
                  <Image source={{ uri: formData.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <Text style={styles.avatarTextLarge}>{formData.name.charAt(0) || "S"}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: SPACING.xs }}>
                <TouchableOpacity onPress={handleUploadAvatar}>
                  <Text style={{ color: COLORS.primary, fontWeight: "700", fontSize: 14 }}>Change Photo</Text>
                </TouchableOpacity>
                {formData.avatar_url && (
                  <TouchableOpacity onPress={handleRemoveAvatar}>
                    <Text style={{ color: "#BE123C", fontWeight: "700", fontSize: 14 }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Name Input */}
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.mutedForeground, marginBottom: 6 }}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(name) => setFormData({ ...formData, name: name.replace(/[^a-zA-Z0-9\s]/g, "") })}
                placeholder="Display Name"
                maxLength={64}
              />
            </View>

            {/* Bio Input */}
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.mutedForeground, marginBottom: 6 }}>Bio</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
                value={formData.bio_line}
                onChangeText={(bio) => setFormData({ ...formData, bio_line: bio })}
                placeholder="Add a short bio or social handles to share with friends..."
                maxLength={150}
                multiline
              />
              <Text style={{ fontSize: 12, color: COLORS.mutedForeground, alignSelf: "flex-end", marginTop: 4 }}>
                {formData.bio_line.length} / 150
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => saveProfileUpdate({ 
                name: formData.name, 
                bio_line: formData.bio_line, 
                avatar_url: formData.avatar_url 
              })}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        );
      case "year":
        return (
          <View key="year" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setEditMode("none")}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Update Year</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.yearRow}>
              {[1, 2, 3, 4, 5].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearButton, formData.year === y && styles.yearButtonSelected]}
                  onPress={() => setFormData({ ...formData, year: y })}
                >
                  <Text style={[styles.yearButtonText, formData.year === y && styles.yearButtonTextSelected]}>
                    {y === 5 ? "5+" : y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => saveProfileUpdate({ year: formData.year })}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        );
      case "major":
        return (
          <View key="major" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setEditMode("none")}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Change Major</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput
              style={styles.input}
              value={formData.major}
              onChangeText={(major) => setFormData({ ...formData, major: major.replace(/[^a-zA-Z0-9\s]/g, "") })}
              placeholder="e.g. Computer Science"
              autoFocus
            />
            {majorSuggestions.filter(s => s.toLowerCase() !== formData.major.toLowerCase()).length > 0 && (
              <View style={[styles.suggestions, { maxHeight: 200 }]}>
                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {majorSuggestions.filter(s => s.toLowerCase() !== formData.major.toLowerCase()).map(s => (
                    <TouchableOpacity key={s} style={styles.suggestionItem} onPress={() => setFormData({ ...formData, major: s })}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity style={styles.saveButton} onPress={saveMajor} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Update Major</Text>}
            </TouchableOpacity>
          </View>
        );
      case "courses":
        return (
          <View key="courses" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setEditMode("none")}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Manage Courses</Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.scheduleTitle}>Visual Class Schedule</Text>
            <Text style={styles.scheduleDesc}>
              Upload a screenshot or photo of your weekly timetable for easy reference.
            </Text>

            {scheduleImage ? (
              <View style={styles.uploadCard}>
                <Image
                  source={{ uri: scheduleImage }}
                  style={styles.schedulePreview}
                  resizeMode="contain"
                />
                <View style={styles.uploadCardActions}>
                  <Text style={styles.uploadCardSuccess}>✓ Schedule uploaded</Text>
                  <TouchableOpacity style={styles.removeButton} onPress={handleRemoveSchedule}>
                    <Text style={styles.removeButtonText}>Remove Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.uploadCardEmpty}>
                {uploadingImage ? (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.uploadingText}>Processing schedule image...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.uploadIconContainer}>
                      <LucideImage size={32} color={COLORS.mutedForeground} />
                    </View>
                    <Text style={styles.uploadCardText}>No schedule photo selected</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={handleUploadSchedule}>
                      <Upload size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.uploadButtonText}>Upload Schedule Image</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <View style={styles.aiBanner}>
              <View style={styles.aiBannerHeader}>
                <View style={styles.aiBadge}>
                  <Sparkles size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.aiBadgeText}>AI PARSING</Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>COMING SOON</Text>
                </View>
              </View>
              <Text style={styles.aiBannerTitle}>Auto-Fill Schedule from Image</Text>
              <Text style={styles.aiBannerDesc}>
                Soon, you won't need to search or type classes. Our AI concierge will read your uploaded schedule image and register all your classes instantly.
              </Text>
            </View>
          </View>
        );
      case "interests":
        const grouped = groupInterestsByCategory(allInterests);
        return (
          <View key="interests" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => saveInterests()} disabled={saving}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Edit Interests</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled">
              {Object.keys(grouped).map((category) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryHeader}>{category}</Text>
                  <View style={styles.categoryTags}>
                    {grouped[category].map((interest) => (
                      <TouchableOpacity
                        key={interest.id}
                        style={[
                          styles.tag,
                          formData.interests.some(i => i.id === interest.id) && styles.tagSelected
                        ]}
                        onPress={() => toggleInterest(interest)}
                        disabled={saving}
                      >
                        <Text style={[
                          styles.tagText,
                          formData.interests.some(i => i.id === interest.id) && styles.tagTextSelected
                        ]}>
                          {interest.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.saveButton, {marginTop: 20}]} 
              onPress={saveInterests} 
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Done</Text>}
            </TouchableOpacity>
          </View>
        );
      case "logout":
        return (
          <View key="logout" style={styles.editContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setEditMode("none")}>
                <ChevronLeft size={24} color={COLORS.foreground} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Sign Out</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={[styles.emptyText, { marginBottom: SPACING.xl, fontSize: 16, fontStyle: 'normal' }]}>
              Are you sure you want to sign out of StudentLink?
            </Text>
            <TouchableOpacity style={styles.saveButton} onPress={handleSignOut}>
              <Text style={styles.saveButtonText}>Yes, Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.md }]} 
              onPress={() => setEditMode("none")}
            >
              <Text style={[styles.saveButtonText, { color: COLORS.foreground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <View key="default">
            <View style={styles.profileHeader}>
              <View style={styles.avatarLarge}>
                {studentData?.avatar_url ? (
                  <Image source={{ uri: studentData.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <Text style={styles.avatarTextLarge}>{formData.name.charAt(0) || "S"}</Text>
                )}
              </View>
              <Text style={styles.profileName}>{formData.name || "Student"}</Text>
              <Text style={styles.profileSchool}>{formData.school}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              {globalLoading && !studentData ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} /> : (
                <>
                  {options.map((opt, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.item}
                      onPress={() => setEditMode(opt.id as EditMode)}
                    >
                      <View style={styles.itemContent}>
                        <opt.icon size={20} color={COLORS.mutedForeground} style={styles.icon} />
                        <Text style={styles.itemText}>{opt.label}</Text>
                      </View>
                      <ChevronRight size={16} color={COLORS.mutedForeground} />
                    </TouchableOpacity>
                  ))}

                  <View style={[styles.item, { justifyContent: 'space-between', paddingVertical: 12 }]}>
                    <View style={styles.itemContent}>
                      <Compass size={20} color={COLORS.mutedForeground} style={styles.icon} />
                      <View>
                        <Text style={styles.itemText}>Discovery Mode</Text>
                        <Text style={{ fontSize: 12, color: COLORS.mutedForeground, marginTop: 2 }}>
                          Appear in peer matches
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={formData.matching_enabled}
                      onValueChange={toggleDiscoveryMode}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Legal</Text>
              <TouchableOpacity
                style={styles.item}
                onPress={() => openExternal("https://studentlink725.github.io/privacy-policy/")}
              >
                <View style={styles.itemContent}>
                  <Text style={styles.itemText}>Privacy Policy</Text>
                </View>
                <ChevronRight size={16} color={COLORS.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.item}
                onPress={() => openExternal("https://studentlink725.github.io/privacy-policy/terms.html")}
              >
                <View style={styles.itemContent}>
                  <Text style={styles.itemText}>Terms of Service</Text>
                </View>
                <ChevronRight size={16} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <TouchableOpacity style={styles.item} onPress={deleteAccountData} disabled={saving}>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemText, { color: "#b91c1c" }]}>Delete Account</Text>
                </View>
                <ChevronRight size={16} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)");
  };

  const deleteAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be signed in to delete your account.");
      return;
    }

    Alert.alert(
      "Delete account?",
      "This removes your StudentLink profile data. Full auth-account deletion still requires a server-side deletion step.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaveLoading(true);
              await AsyncStorage.removeItem("student_schedule_image");
              await supabase.from("student_courses").delete().eq("student_id", user.id);
              await supabase.from("student_interests").delete().eq("student_id", user.id);
              await supabase.from("connection_requests").delete().or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
              await supabase.from("friend_connections").delete().or(`user_low_id.eq.${user.id},user_high_id.eq.${user.id}`);
              await supabase.from("peer_similarity").delete().or(`user_id.eq.${user.id},peer_id.eq.${user.id}`);
              await supabase.from("ignored_peers").delete().or(`user_id.eq.${user.id},peer_id.eq.${user.id}`);
              await supabase.from("event_rsvps").delete().eq("student_id", user.id);
              await supabase.from("students").delete().eq("id", user.id);

              await supabase.auth.signOut();
              router.replace("/(auth)");
            } catch (err: any) {
              console.error("Error deleting account:", err?.message || err);
              Alert.alert("Error", "Failed to delete the account data.");
            } finally {
              setSaveLoading(false);
            }
          },
        },
      ]
    );
  };

  const openExternal = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Unavailable", "This link cannot be opened on this device.");
      }
    } catch {
      Alert.alert("Error", "Could not open the link.");
    }
  };

  const options = [
    { id: "profile", label: "Edit Profile", icon: User },
    { id: "year", label: "Update Year", icon: Calendar },
    { id: "major", label: "Change Major", icon: GraduationCap },
    // { id: "courses", label: "Manage Courses", icon: BookOpen },
    { id: "interests", label: "Edit Interests", icon: Heart },
    { id: "logout", label: "Sign Out", icon: LogOut },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {renderEditContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  avatarTextLarge: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.foreground,
  },
  profileSchool: {
    fontSize: 16,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  section: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: SPACING.md,
    color: COLORS.foreground,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: SPACING.md,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  editContainer: {
    paddingBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xl,
  },
  editTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.foreground,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    marginBottom: SPACING.md,
    color: COLORS.foreground,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  yearRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  yearButton: {
    flex: 1,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
  },
  yearButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.foreground,
  },
  yearButtonTextSelected: {
    color: COLORS.primary,
  },
  suggestions: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.foreground,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  inlineAddButton: {
    backgroundColor: COLORS.primary,
    padding: 6,
    borderRadius: RADIUS.sm,
    marginLeft: 8,
  },
  sectionSub: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.mutedForeground,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl, // Changed to XL for pill look
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  tagTextSelected: {
    color: "#fff",
  },
  emptyText: {
    color: COLORS.mutedForeground,
    fontStyle: "italic",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },
  categorySection: {
    marginBottom: SPACING.lg,
  },
  categoryHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.foreground,
    marginBottom: SPACING.sm,
    textTransform: "capitalize",
  },
  categoryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xl,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.foreground,
    marginBottom: SPACING.xs,
  },
  scheduleDesc: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  uploadCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  uploadCardEmpty: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    minHeight: 180,
  },
  schedulePreview: {
    width: "100%",
    height: 200,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  uploadCardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  uploadCardSuccess: {
    fontSize: 14,
    fontWeight: "600",
    color: "#047857",
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
  uploadingContainer: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  uploadingText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: SPACING.xs,
  },
  uploadIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  uploadCardText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginBottom: SPACING.md,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  aiBanner: {
    backgroundColor: "rgba(37, 99, 235, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.15)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  aiBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: "rgba(0, 129, 167, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.foreground,
    letterSpacing: 0.5,
  },
  aiBannerTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.foreground,
    marginBottom: 4,
    marginTop: 4,
  },
  aiBannerDesc: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    lineHeight: 18,
  },
});
