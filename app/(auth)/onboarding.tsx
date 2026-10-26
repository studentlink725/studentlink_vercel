import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS } from "../../src/components/Theme";
import { 
  BookOpen, 
  ChevronLeft,
  ArrowRight,
  Plus,
  X,
  Search,
  User,
  Upload,
  Sparkles,
  Image as LucideImage,
} from "lucide-react-native";
import { supabase } from "../../src/lib/supabase";
import { useStudent } from "../../src/data/persona-context";

const YEARS = [1, 2, 3, 4, 5];

const INSTITUTIONS = [
  { name: "NorQuest College", active: true },
  { name: "University of Alberta", active: false },
  { name: "MacEwan University", active: false },
];

const DOMAIN_TO_SCHOOL: Record<string, string> = {
  "ualberta.ca": "University of Alberta",
  "mymacewan.ca": "MacEwan University",
  "norquest.ca": "NorQuest College",
};

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

export default function Onboarding() {
  const { allInterests, interestsLoading, interestsError, refreshInterests, refreshData } = useStudent();
  const [step, setStep] = useState(2);
  const { email } = useLocalSearchParams();

  const [scheduleImage, setScheduleImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load schedule image on mount
  useEffect(() => {
    const loadScheduleImage = async () => {
      try {
        const stored = await AsyncStorage.getItem("student_schedule_image");
        if (stored) setScheduleImage(stored);
      } catch (err) {
        console.error("Error loading schedule image:", err);
      }
    };
    loadScheduleImage();
  }, []);

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
        }
      }
    } catch (err) {
      console.error("Error removing schedule image:", err);
    }
  };
  
  const [formData, setFormData] = useState({
    name: "",
    school: "NorQuest College",
    major: "",
    year: null as number | null,
    courses: [] as string[],
    interests: [] as {id: string, interest: string}[],
  });

  const [courseInput, setCourseInput] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [majorSuggestions, setMajorSuggestions] = useState<string[]>([]);
  const [loadingMajors, setLoadingMajors] = useState(false);

  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const fetchMajorSuggestions = async () => {
      const trimmed = formData.major.trim();
      if (trimmed.length < 2 || !formData.school) {
        setMajorSuggestions([]);
        return;
      }

      setLoadingMajors(true);
      const { data, error } = await supabase
        .from('majors')
        .select('major')
        .eq('school', formData.school)
        .ilike('major', `%${trimmed}%`)
        .limit(5);

      if (!error && data) {
        setMajorSuggestions(data.map(d => d.major));
      }
      setLoadingMajors(false);
    };

    const timer = setTimeout(fetchMajorSuggestions, 300);
    return () => clearTimeout(timer);
  }, [formData.major, formData.school]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const trimmed = courseInput.trim();
      if (trimmed.length < 2 || !formData.school) {
        setCourseSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);
      const { data, error } = await supabase
        .from('courses')
        .select('course')
        .eq('school', formData.school)
        .ilike('course', `%${trimmed}%`)
        .limit(5);

      if (!error && data) {
        setCourseSuggestions(data.map(d => d.course));
      }
      setLoadingSuggestions(false);
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [courseInput, formData.school]);

  const router = useRouter();

  const handleNext = async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        Alert.alert("Auth Error", authError.message);
        return;
      }

      const user = authData?.user;

      if (!user) {
        Alert.alert("Auth Error", "No authenticated user found. Please log in again.");
        return;
      }

      const userId = user.id;
      const userEmail = typeof email === 'string' ? email : (user.email || "");
      
      // Step 1: Select School and create initial Student record
      if (step === 1) {
        if (!formData.school) {
          Alert.alert("Missing Info", "Please select your institution first.");
          return;
        }

        const payload = {
          id: userId,
          school: formData.school,
          email: userEmail,
        };

        const { error } = await supabase
          .from('students')
          .upsert(payload, { onConflict: 'id' });
        
        if (error) {
          Alert.alert("Database Error", `Failed to save: ${error.message}`);
          return;
        }
        
        setStep(2);
        return;
      }

      // Step 2: Handle Name entry and create/update Student record
      if (step === 2) {
        let displayName = formData.name.trim();
        
        // Fallback to email prefix if no nickname provided
        if (!displayName) {
          const emailSource = typeof email === 'string' ? email : user.email;
          if (emailSource && emailSource.includes('@')) {
            displayName = emailSource.split('@')[0];
            // Basic cleanup for the extracted email prefix
            displayName = displayName.replace(/[^a-zA-Z0-9]/g, ' '); 
            displayName = toTitleCase(displayName).trim();
          }
        }

        if (displayName) {
          const payload = {
            id: userId,
            school: formData.school,
            email: userEmail,
            name: displayName
          };
          const { error } = await supabase
            .from('students')
            .upsert(payload, { onConflict: 'id' });
          
          if (error) {
            Alert.alert("Database Error", `Failed to save student profile: ${error.message}`);
            return;
          }
          
          setFormData(prev => ({ ...prev, name: displayName }));
          setStep(3);
        } else {
          Alert.alert("Validation", "A name or nickname is required.");
        }
        return;
      }

      // Step 3: Handle Major and link to Student record
      if (step === 3) {
        const trimmedMajor = formData.major.trim();
        const formattedMajor = toTitleCase(trimmedMajor);
        
        const updateData: any = {
          id: userId,
          school: formData.school,
          year: formData.year,
        };

        if (formattedMajor.length >= 3 && formattedMajor.length <= 64) {
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
            updateData.major_id = newMajorId;
          }
          
          setFormData(prev => ({ ...prev, major: formattedMajor }));
        }

        const { error: upsertError } = await supabase
          .from('students')
          .upsert(updateData, { onConflict: 'id' });
        
        if (upsertError) {
          Alert.alert("Database Error", upsertError.message);
          return;
        }
        setStep(5); // skip step 4
        return;
      }

      // Step 4: Handle Course associations (Visual Schedule Upload - database association bypassed for Beta)
      if (step === 4) {
        setStep(5);
        return;
      }

      // Step 5: Handle Interests
      if (step === 5) {
        // Perform background saving of interests concurrently
        const saveInterestsOnboarding = async () => {
          try {
            if (formData.interests.length > 0) {
              const interestLinks = formData.interests.map(i => ({
                student_id: userId,
                interest_id: i.id
              }));

              const { error: interestError } = await supabase
                .from('student_interests')
                .upsert(interestLinks, { onConflict: 'student_id, interest_id' });
              
              if (interestError) {
                console.error("Database Error saving onboarding interests:", interestError.message);
              }
            }
            
            // Finalize state and trigger global refresh
            await refreshData();
            DeviceEventEmitter.emit('profileUpdated');
            
            // Go to home tab after state is fully loaded
            router.replace("/(tabs)");
          } catch (err: any) {
            console.error("Error saving interests in onboarding background:", err.message);
            router.replace("/(tabs)");
          }
        };

        saveInterestsOnboarding();
      }
    } catch (err: any) {
      Alert.alert("Runtime Error", err.message || "An unknown error occurred");
    }
  };

  const handleBack = () => {
    if (step === 5) {
      setStep(3); // skip step 4
    } else if (step > 2) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const validateCourseFormat = (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length > 64) return false;
    const regex = /^[A-Z]{2,}\s\d{3}$/;
    return regex.test(trimmed.toUpperCase());
  };

  const addCourse = async (courseName: string) => {
    const cleanName = courseName.trim().toUpperCase();
    if (!cleanName || formData.courses.includes(cleanName) || !validateCourseFormat(cleanName)) return;

    if (formData.courses.length >= 7) {
      Alert.alert("Course Limit Reached", "You can only enroll in up to 7 classes at a time.");
      return;
    }

    setFormData(prev => ({
      ...prev,
      courses: [...prev.courses, cleanName]
    }));
    setCourseInput("");
    setCourseSuggestions([]);

    const processDB = async () => {
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('school', formData.school)
        .eq('course', cleanName)
        .maybeSingle();

      if (!existing) {
        Alert.alert(
          "Course not found",
          "Please choose an existing course from the suggestions. New courses can no longer be created from the app."
        );
        setFormData(prev => ({
          ...prev,
          courses: prev.courses.filter(course => course !== cleanName)
        }));
        return;
      }
    };

    processDB();
  };

  const removeCourse = (courseName: string) => {
    setFormData(prev => ({
      ...prev,
      courses: prev.courses.filter(c => c !== courseName)
    }));
  };

  const toggleInterest = (interest: {id: string, interest: string}) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.some(i => i.id === interest.id)
        ? prev.interests.filter(i => i.id !== interest.id)
        : [...prev.interests, interest]
    }));
  };

  const getButtonText = () => {
    if (step === 1) return "Continue";
    if (step === 2) return formData.name.trim().length >= 2 ? "Next" : "Skip For Now";
    if (step === 3) {
      const isComplete = formData.major.trim().length >= 3 && formData.year;
      return isComplete ? "Next" : "Skip For Now";
    }
    if (step === 4) {
      const isComplete = scheduleImage !== null;
      return isComplete ? "Next" : "Skip For Now";
    }
    if (step === 5) return "Complete Signup";
    return "Next";
  };

  const isNextDisabled = () => {
    if (step === 1 && !formData.school) return true;
    return false;
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Select your School</Text>
              <Text style={styles.subtitle}>Find your campus community. Choose your school to start connecting with students near you.</Text>
            </View>
            <View style={styles.institutionList}>
              {INSTITUTIONS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    styles.institutionButton,
                    !item.active && styles.institutionButtonDisabled,
                    formData.school === item.name && styles.institutionButtonSelected
                  ]}
                  onPress={() => item.active && setFormData({ ...formData, school: item.name })}
                  disabled={!item.active}
                >
                  <View style={styles.institutionInfo}>
                    <Text style={[
                      styles.institutionName,
                      !item.active && styles.institutionTextDisabled,
                      formData.school === item.name && styles.institutionTextSelected
                    ]}>
                      {item.name}
                    </Text>
                    {!item.active && (
                      <Text style={styles.betaBadge}>Coming Soon</Text>
                    )}
                  </View>
                  {formData.school === item.name && (
                    <ArrowRight size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.header}>
              <View style={styles.schoolHeaderRow}>
                <Text style={styles.schoolBadge}>{formData.school}</Text>
              </View>
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>This is how you'll appear to other students on StudentLink.</Text>
            </View>
            <View style={styles.inputContainer}>
              <User size={20} color={COLORS.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name or nickname"
                placeholderTextColor={COLORS.mutedForeground}
                value={formData.name}
                onChangeText={(name) => {
                  const filtered = name.replace(/[^a-zA-Z0-9\s]/g, "");
                  setFormData({ ...formData, name: filtered });
                }}
                maxLength={64}
              />
            </View>
          </View>
        );
      case 3:
        return (
          <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.schoolBadge}>{formData.school}</Text>
              <Text style={styles.title}>What's your Major?</Text>
              <Text style={styles.subtitle}>Your program and year. Used to find shared classes.</Text>
            </View>
            <View style={styles.inputContainer}>
              <BookOpen size={20} color={COLORS.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Computer Science"
                placeholderTextColor={COLORS.mutedForeground}
                value={formData.major}
                onChangeText={(major) => {
                  const filtered = major.replace(/[^a-zA-Z0-9\s]/g, "");
                  setFormData({ ...formData, major: filtered });
                }}
              />
              {loadingMajors && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            {majorSuggestions.filter(s => s.toLowerCase() !== formData.major.trim().toLowerCase()).length > 0 && (
              <View style={[styles.suggestions, { maxHeight: 200 }]}>
                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                  {majorSuggestions
                    .filter(s => s.toLowerCase() !== formData.major.trim().toLowerCase())
                    .map((suggestion) => (
                      <TouchableOpacity 
                        key={suggestion} 
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFormData({ ...formData, major: suggestion });
                          setMajorSuggestions([]);
                        }}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <ArrowRight size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
            
            <View style={styles.yearSection}>
              <Text style={styles.yearLabel}>Year of Study</Text>
              <View style={styles.yearRow}>
                {YEARS.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.yearButton,
                      formData.year === year && styles.yearButtonSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, year })}
                  >
                    <Text style={[
                      styles.yearButtonText,
                      formData.year === year && styles.yearButtonTextSelected
                    ]}>
                      {year === 5 ? "5+" : year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Your Classes</Text>
              <Text style={styles.subtitle}>Upload a screenshot or photo of your weekly timetable.</Text>
            </View>

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
                Our AI concierge will soon automatically parse your schedule image to populate your classes list instantly!
              </Text>
            </View>
          </View>
        );
      case 5:
        const grouped = groupInterestsByCategory(allInterests);
        return (
          <View style={styles.stepContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>What are your interests?</Text>
              <Text style={styles.subtitle}>Select at least one to help us match you.</Text>
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
                          formData.interests.some(i => i.id === interest.id) && styles.tagSelected,
                        ]}
                        onPress={() => toggleInterest(interest)}
                      >
                        <Text style={[styles.tagText, formData.interests.some(i => i.id === interest.id) && styles.tagTextSelected]}>
                          {interest.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              {allInterests.length === 0 && interestsLoading && (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
              )}
              {allInterests.length === 0 && interestsError && (
                <View style={{ alignItems: "center", padding: SPACING.lg }}>
                  <Text style={styles.subtitle}>We couldn’t load interests. Check your connection and try again.</Text>
                  <TouchableOpacity onPress={() => void refreshInterests()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
              {allInterests.length === 0 && !interestsLoading && !interestsError && (
                <Text style={styles.subtitle}>No interests are available right now.</Text>
              )}
            </ScrollView>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.flex}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={24} color={COLORS.foreground} />
          </TouchableOpacity>
          <View style={styles.progressBarContainer}>
            {(() => {
              const totalSteps = 3;
              let currentStep = 1;
              if (step === 3) currentStep = 2;
              if (step === 5) currentStep = 3;
              return (
                <>
                  <View style={[styles.progressBar, { width: `${(currentStep / totalSteps) * 100}%` }]} />
                  <View style={styles.stepIndicator}>
                    <Text style={styles.stepIndicatorText}>{currentStep}/{totalSteps}</Text>
                  </View>
                </>
              );
            })()}
          </View>
        </View>

        <View style={styles.content}>
          {renderStep()}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, isNextDisabled() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={isNextDisabled()}
          >
            <Text style={styles.buttonText}>{getButtonText()}</Text>
            {step < 5 && <ArrowRight size={20} color={COLORS.background} />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md, // Pushes the header down from the top edge
    gap: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.muted,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  stepIndicator: {
    paddingHorizontal: SPACING.sm,
  },
  stepIndicatorText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.mutedForeground,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  stepContainer: {
    flex: 1,
  },
  header: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  schoolBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary,
    color: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: SPACING.sm,
    overflow: "hidden",
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
  schoolHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  changeSchoolLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeSchoolText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  institutionList: {
    gap: SPACING.md,
  },
  institutionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  institutionButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
  },
  institutionButtonDisabled: {
    opacity: 0.5,
  },
  institutionInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  institutionName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  institutionTextSelected: {
    color: COLORS.primary,
  },
  institutionTextDisabled: {
    color: COLORS.mutedForeground,
  },
  betaBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.mutedForeground,
    backgroundColor: COLORS.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
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
    marginBottom: SPACING.lg,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.foreground,
  },
  yearSection: {
    gap: SPACING.sm,
  },
  yearLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.mutedForeground,
  },
  yearRow: {
    flexDirection: "row",
    gap: SPACING.sm,
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
    fontWeight: "600",
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
    marginTop: -SPACING.md,
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
    fontSize: 16,
    color: COLORS.foreground,
  },
  formatHelper: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.mutedForeground,
    marginBottom: SPACING.md,
    marginTop: -SPACING.sm,
  },
  inlineAddButton: {
    backgroundColor: COLORS.primary,
    padding: 6,
    borderRadius: RADIUS.sm,
    marginLeft: 8,
  },
  coursesList: {
    flex: 1,
  },
  coursesListContent: {
    paddingBottom: SPACING.lg,
  },
  selectedCourses: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  courseTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.muted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  courseTagText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.mutedForeground,
    marginTop: SPACING.xl,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  tag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    fontSize: 14,
    color: COLORS.foreground,
  },
  tagTextSelected: {
    color: COLORS.background,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.background,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 140,
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
