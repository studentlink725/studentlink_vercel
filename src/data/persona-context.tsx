import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Persona, PERSONAS } from "./personas";
import { supabase } from "../lib/supabase";
import { DeviceEventEmitter } from "react-native";

interface StudentData {
  name: string;
  year: number | null;
  major: string;
  major_id: string | null;
  school: string;
  matching_enabled: boolean;
  courses: { id: string, course: string }[];
  interests: { id: string, interest: string }[];
  bio_line: string | null;
  schedule_image: string | null;
  share_bio: boolean;
  avatar_url: string | null;
}

interface StudentContextType {
  persona: Persona;
  setPersona: (id: Persona["id"]) => void;
  studentData: StudentData | null;
  loading: boolean;
  refreshData: (forcedUserId?: string) => Promise<void>;
  preloadedMajors: string[];
  preloadedCourses: { id: string, course: string }[];
  allInterests: { id: string, interest: string }[];
  interestsLoading: boolean;
  interestsError: string | null;
  refreshInterests: () => Promise<void>;
  updateStudentData: (data: Partial<StudentData>) => void;
}


const StudentContext = createContext<StudentContextType | undefined>(undefined);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(PERSONAS[0]);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preloadedMajors, setPreloadedMajors] = useState<string[]>([]);
  const [preloadedCourses, setPreloadedCourses] = useState<{ id: string, course: string }[]>([]);
  const [allInterests, setAllInterests] = useState<{ id: string, interest: string }[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);

  const fetchStudentData = useCallback(async (forcedUserId?: string) => {
    let activeUserId = forcedUserId;
    
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }

    if (!activeUserId) {
      setLoading(false);
      setStudentData(null);
      return;
    }

    try {
      const studentPromise = (async () => {
        let res = await supabase
          .from('students')
          .select(`
            name,
            school,
            year,
            major_id,
            matching_enabled,
            bio_line,
            share_bio,
            avatar_url,
            majors (major)
          `)
          .eq('id', activeUserId)
          .maybeSingle();

        if (res.error) {
          console.warn("Main query failed (likely missing columns), trying fallback query:", res.error.message);
          res = await supabase
            .from('students')
            .select(`
              name,
              school,
              year,
              major_id,
              matching_enabled,
              bio_line,
              majors (major)
            `)
            .eq('id', activeUserId)
            .maybeSingle();
        }
        return res;
      })();

      const [studentResponse, coursesResponse, studentInterestsResponse] = await Promise.all([
        studentPromise,
        supabase
          .from('student_courses')
          .select(`
            courses (id, course)
          `)
          .eq('student_id', activeUserId),
        supabase
          .from('student_interests')
          .select(`
            interests (id, interest)
          `)
          .eq('student_id', activeUserId)
      ]);

      if (studentResponse.data) {
        const student = studentResponse.data;
        const userCourses = coursesResponse.data ? coursesResponse.data.map(uc => uc.courses).filter(Boolean) : [];
        const userInterests = studentInterestsResponse.data ? studentInterestsResponse.data.map(ui => ui.interests).filter(Boolean) : [];

        setStudentData({
          name: student.name || "",
          school: student.school || "",
          year: student.year || null,
          major: (student as any).majors?.major || "",
          major_id: student.major_id || null,
          matching_enabled: student.matching_enabled ?? true,
          courses: userCourses as any[],
          interests: userInterests as any[],
          bio_line: student.bio_line || null,
          schedule_image: null,
          share_bio: student.share_bio ?? true,
          avatar_url: student.avatar_url || null,
        });
      } else {
        setStudentData(null);
      }
    } catch (error) {
      console.error("Error in StudentProvider fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const preloadAppMetadata = useCallback(async () => {
    setInterestsLoading(true);
    setInterestsError(null);
    try {
      const { data, error } = await supabase.from('interests').select('id, interest').order('interest');
      if (error) throw error;
      setAllInterests(data ?? []);
    } catch (err) {
      console.error("Error preloading interests:", err);
      setInterestsError(err instanceof Error ? err.message : "Could not load interests.");
    } finally {
      setInterestsLoading(false);
    }
  }, []);

  const preloadUniversityData = useCallback(async (school: string) => {
    if (!school) return;
    
    try {
      const [majorsRes, popularCoursesRes] = await Promise.all([
        supabase.from('majors').select('major').eq('school', school).limit(100),
        supabase.from('courses').select('id, course').eq('school', school).limit(50)
      ]);

      if (majorsRes.data) setPreloadedMajors(majorsRes.data.map(m => m.major));
      if (popularCoursesRes.data) setPreloadedCourses(popularCoursesRes.data);
    } catch (err) {
      console.error("Error preloading school data:", err);
    }
  }, []);

  useEffect(() => {
    fetchStudentData();
    
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // The interests catalog is restricted to authenticated users by RLS.
        // Load it after Supabase restores or establishes the session.
        void preloadAppMetadata();
        fetchStudentData(session.user.id);
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        setAllInterests([]);
        setInterestsError(null);
        setInterestsLoading(false);
      }
      if (event === 'SIGNED_OUT') {
        setStudentData(null);
        setLoading(false);
      }
    });

    const updateSubscription = DeviceEventEmitter.addListener('profileUpdated', () => fetchStudentData());
    
    return () => {
      authSubscription.unsubscribe();
      updateSubscription.remove();
    };
  }, [fetchStudentData, preloadAppMetadata]);

  useEffect(() => {
    if (studentData?.school) {
      preloadUniversityData(studentData.school);
    }
  }, [studentData?.school, preloadUniversityData]);

  const setPersona = (id: Persona["id"]) => {
    const found = PERSONAS.find((p) => p.id === id);
    if (found) setPersonaState(found);
  };

  const updateStudentData = useCallback((data: Partial<StudentData>) => {
    setStudentData(prev => prev ? { ...prev, ...data } : null);
  }, []);

  return (
    <StudentContext.Provider value={{ 
      persona, 
      setPersona, 
      studentData, 
      loading, 
      refreshData: fetchStudentData,
      preloadedMajors,
      preloadedCourses,
      allInterests,
      interestsLoading,
      interestsError,
      refreshInterests: preloadAppMetadata,
      updateStudentData
    }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error("useStudent must be used within a StudentProvider");
  }
  return context;
}
