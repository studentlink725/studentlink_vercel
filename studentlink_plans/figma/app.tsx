import { useState, useRef, useCallback } from "react";
import {
  Mail, ArrowRight, Key, ChevronLeft, BookOpen, Search, Check,
  Gamepad2, Film, Music, Code2, Camera, Mountain, Palette, Rocket,
  HeartHandshake, ChefHat, HeartPulse, Home, Calendar, Users, Compass,
  UserCircle, Sparkles, Bell, DollarSign, Briefcase, Globe, Laptop,
  MapPin, Clock, User, GraduationCap, Heart, LogOut, X, UserCheck,
  ImagePlus, ScanLine, RefreshCw, AlertCircle,
} from "lucide-react";

type Screen =
  | "signin" | "otp"
  | "onboard1" | "onboard2" | "onboard3" | "onboard4"
  | "dashboard" | "events" | "matches" | "resources" | "profile"
  | "edit-name" | "edit-year" | "edit-major" | "manage-courses" | "edit-interests";

type Tab = "dashboard" | "events" | "matches" | "resources";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  primary: "#2563EB",
  accent: "#0081A7",
  bg: "#FFFFFF",
  muted: "#F1F5F9",
  textPrimary: "#020817",
  textMuted: "#64748B",
  border: "#E2E8F0",
  dark: "#020817",
};

// ─── Shared state (lifted so profile edits persist) ───────────────────────────
// We store user profile state at the root so edits from profile sub-screens
// are reflected app-wide.
type UserProfile = {
  name: string;
  major: string;
  year: number;
  courses: string[];
  interests: Set<string>;
};

// ─── Shared primitives ────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ height: 44, fontSize: 12, fontWeight: 600, color: C.textPrimary }}>
      <span>9:41</span>
      <div className="flex gap-1 items-center">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x="0" y="3" width="3" height="9" rx="1" fill={C.textPrimary} /><rect x="4.5" y="2" width="3" height="10" rx="1" fill={C.textPrimary} /><rect x="9" y="0" width="3" height="12" rx="1" fill={C.textPrimary} /><rect x="13.5" y="1" width="2.5" height="10" rx="0.8" fill={C.textPrimary} opacity="0.3" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 2.5C5.6 2.5 3.4 3.5 1.8 5.2L0 3.4C2.1 1.3 5 0 8 0s5.9 1.3 8 3.4l-1.8 1.8C12.6 3.5 10.4 2.5 8 2.5z" fill={C.textPrimary} opacity="0.4" /><path d="M8 6c-1.5 0-2.8.6-3.8 1.5L2.4 5.7C3.8 4.3 5.8 3.5 8 3.5s4.2.8 5.6 2.2l-1.8 1.8C10.8 6.6 9.5 6 8 6z" fill={C.textPrimary} opacity="0.6" /><path d="M8 9.5c-.8 0-1.5.3-2 .8L4.2 8.5C5.1 7.6 6.5 7 8 7s2.9.6 3.8 1.5l-1.8 1.8c-.5-.5-1.2-.8-2-.8z" fill={C.textPrimary} /><circle cx="8" cy="11" r="1" fill={C.textPrimary} /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke={C.textPrimary} strokeOpacity="0.35" /><rect x="2" y="2" width="16" height="8" rx="2" fill={C.textPrimary} /><path d="M23 4.5v3a1.5 1.5 0 0 0 0-3z" fill={C.textPrimary} strokeOpacity="0.4" /></svg>
      </div>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div className="flex justify-center pb-2 pt-1">
      <div style={{ width: 134, height: 5, background: C.textPrimary, borderRadius: 99, opacity: 0.2 }} />
    </div>
  );
}

function AppHeader({ onProfileClick }: { onProfileClick?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4" style={{ height: 56, background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>StudentLink</span>
      <button onClick={onProfileClick}><UserCircle size={24} color={C.primary} /></button>
    </div>
  );
}

function BottomTabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; Icon: typeof Home }[] = [
    { id: "dashboard", label: "Home", Icon: Home },
    { id: "events", label: "Events", Icon: Calendar },
    { id: "matches", label: "Matches", Icon: Users },
    { id: "resources", label: "Resources", Icon: Compass },
  ];
  return (
    <div style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}>
      <div className="flex">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button key={id} className="flex-1 flex flex-col items-center py-3 gap-0.5" onClick={() => onChange(id)}>
              <Icon size={22} color={isActive ? C.primary : C.textMuted} strokeWidth={isActive ? 2.5 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.primary : C.textMuted }}>{label}</span>
            </button>
          );
        })}
      </div>
      <HomeIndicator />
    </div>
  );
}

function CategoryTag({ type }: { type: "ACADEMIC" | "WELLNESS" | "SOCIAL" | "CAREER" }) {
  const map = {
    ACADEMIC: { bg: "#FFFBEB", text: "#B45309" },
    WELLNESS: { bg: "#FFF1F2", text: "#BE123C" },
    SOCIAL: { bg: "#ECFDF5", text: "#047857" },
    CAREER: { bg: "#E0F4F8", text: "#0081A7" },
  };
  const { bg, text } = map[type];
  return (
    <span style={{ background: bg, color: text, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, letterSpacing: "0.05em" }}>
      {type}
    </span>
  );
}

// ─── Sub-screen header (used for profile sub-screens) ─────────────────────────
function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4" style={{ height: 56, borderBottom: `1px solid ${C.border}` }}>
      <button onClick={onBack} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChevronLeft size={22} color={C.textPrimary} />
      </button>
      <span style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{title}</span>
    </div>
  );
}

// ─── Image Schedule Parser ─────────────────────────────────────────────────────
// Simulates AI parsing of a schedule image.
// In production, swap parseMockSchedule for a real API call (e.g. Claude vision).

const MOCK_PARSE_RESULTS: Record<number, string[]> = {
  0: ["CMPT 101", "MATH 120", "ENGL 102", "COMM 150"],
  1: ["PHYS 201", "CHEM 110", "BIOL 230", "MATH 121", "WRIT 101"],
  2: ["BUSA 100", "ACCT 101", "MKTG 200", "ECON 105"],
};

function parseMockSchedule(seed: number): Promise<string[]> {
  return new Promise(resolve =>
    setTimeout(() => resolve(MOCK_PARSE_RESULTS[seed % 3] ?? MOCK_PARSE_RESULTS[0]), 2200)
  );
}

type ParseState = "idle" | "uploading" | "parsing" | "done" | "error";

function CourseImageParser({
  courses,
  onChange,
  onConfirm,
  confirmLabel = "Save Courses",
}: {
  courses: string[];
  onChange: (c: string[]) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parsedCandidates, setParsedCandidates] = useState<string[]>([]);
  const [checkedCandidates, setCheckedCandidates] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const seedRef = useRef(0);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setParseState("uploading");
    // Simulate brief upload then parsing
    setTimeout(async () => {
      setParseState("parsing");
      try {
        const results = await parseMockSchedule(seedRef.current++);
        setParsedCandidates(results);
        // Pre-check courses not already in the list
        setCheckedCandidates(new Set(results.filter(r => !courses.includes(r))));
        setParseState("done");
      } catch {
        setParseState("error");
      }
    }, 600);
  }, [courses]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }, [handleFile]);

  const toggleCandidate = (c: string) => {
    const next = new Set(checkedCandidates);
    next.has(c) ? next.delete(c) : next.add(c);
    setCheckedCandidates(next);
  };

  const applyParsed = () => {
    const toAdd = [...checkedCandidates].filter(c => !courses.includes(c));
    onChange([...courses, ...toAdd]);
    setParseState("idle");
    setImageUrl(null);
    setParsedCandidates([]);
    setCheckedCandidates(new Set());
  };

  const reset = () => {
    setParseState("idle");
    setImageUrl(null);
    setParsedCandidates([]);
    setCheckedCandidates(new Set());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload zone */}
      {parseState === "idle" && (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-3 w-full"
          style={{
            border: `2px dashed ${C.border}`,
            borderRadius: 16,
            padding: "32px 20px",
            background: "#FAFBFF",
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
        >
          <div style={{ width: 56, height: 56, background: "#EFF6FF", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImagePlus size={26} color={C.primary} />
          </div>
          <div className="text-center">
            <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Upload your schedule</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4, lineHeight: "18px" }}>Tap to select a photo of your class schedule<br />and AI will extract your courses automatically.</p>
          </div>
          <div className="flex items-center gap-1.5" style={{ background: C.muted, borderRadius: 8, padding: "5px 12px" }}>
            <ScanLine size={14} color={C.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Supports JPG, PNG, PDF screenshots</span>
          </div>
        </button>
      )}

      {/* Uploading / Parsing state */}
      {(parseState === "uploading" || parseState === "parsing") && imageUrl && (
        <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, position: "relative" }}>
          <img src={imageUrl} alt="Schedule preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(2,8,23,0.65)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            {/* Animated scan line */}
            <div style={{ position: "relative", width: 200 }}>
              <div style={{ height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 99 }} />
              <div style={{
                position: "absolute", top: 0, left: 0, height: 2,
                background: C.primary, borderRadius: 99,
                animation: "scanProgress 2s ease-in-out forwards",
                boxShadow: `0 0 8px ${C.primary}`,
              }} />
            </div>
            <div className="flex items-center gap-2">
              <ScanLine size={18} color="#fff" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                {parseState === "uploading" ? "Uploading image…" : "Analyzing schedule…"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>AI is reading your course codes</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {parseState === "error" && (
        <div className="flex flex-col items-center gap-3 p-5" style={{ border: `1px solid #FFF1F2`, borderRadius: 16, background: "#FFF1F2" }}>
          <AlertCircle size={28} color="#BE123C" />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#BE123C", textAlign: "center" }}>{"Couldn't"} read the schedule. Try a clearer photo.</p>
          <button onClick={reset} className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}

      {/* Parsed results */}
      {parseState === "done" && (
        <div style={{ border: `1.5px solid rgba(37,99,235,0.2)`, borderRadius: 16, overflow: "hidden" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#EFF6FF", borderBottom: `1px solid rgba(37,99,235,0.1)` }}>
            <div className="flex items-center gap-2">
              <Check size={16} color="#047857" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#047857" }}>
                {parsedCandidates.length} courses detected
              </span>
            </div>
            <button onClick={reset} style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>
              Re-scan
            </button>
          </div>
          {/* Thumbnail + courses side by side */}
          <div className="flex gap-3 p-4">
            {imageUrl && (
              <img src={imageUrl} alt="Schedule" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}` }} />
            )}
            <div className="flex flex-col gap-2 flex-1">
              {parsedCandidates.map(course => {
                const alreadyAdded = courses.includes(course);
                const checked = checkedCandidates.has(course);
                return (
                  <button
                    key={course}
                    onClick={() => !alreadyAdded && toggleCandidate(course)}
                    className="flex items-center gap-2.5"
                    style={{ cursor: alreadyAdded ? "default" : "pointer" }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: alreadyAdded || checked ? `2px solid ${C.primary}` : `2px solid ${C.border}`,
                      background: alreadyAdded || checked ? C.primary : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {(alreadyAdded || checked) && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: alreadyAdded ? C.textMuted : C.textPrimary }}>
                      {course}
                    </span>
                    {alreadyAdded && (
                      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>already added</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={applyParsed}
              className="flex items-center justify-center gap-2 w-full"
              style={{ height: 44, background: C.primary, borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700 }}
            >
              <Check size={16} color="#fff" />
              Add {[...checkedCandidates].filter(c => !courses.includes(c)).length} selected courses
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Current course tags */}
      {courses.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
            {parseState === "idle" ? "Your courses" : "Currently added"}
          </p>
          <div className="flex flex-wrap gap-2">
            {courses.map(cls => (
              <div key={cls} className="flex items-center gap-1.5 px-3 py-2" style={{ background: C.muted, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{cls}</span>
                <button onClick={() => onChange(courses.filter(c => c !== cls))}>
                  <X size={14} color={C.textMuted} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan animation keyframes */}
      <style>{`
        @keyframes scanProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─── Screen 1: Sign In ────────────────────────────────────────────────────────
function SignInScreen({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="flex-1 flex flex-col justify-center px-6 gap-8">
        <div className="flex flex-col items-center gap-4">
          <div style={{ width: 48, height: 48, background: C.primary, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>S</span>
          </div>
          <div className="text-center">
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>Welcome to StudentLink</h1>
            <p style={{ fontSize: 16, color: C.textMuted, marginTop: 8 }}>Enter your email to get started.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4" style={{ height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <Mail size={20} color={C.textMuted} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your-email@example.com" className="flex-1 outline-none bg-transparent" style={{ fontSize: 16, color: C.textPrimary }} />
          </div>
          <button onClick={onNext} className="flex items-center justify-center gap-2" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
            Next <ArrowRight size={20} color="#fff" />
          </button>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ─── Screen 2: OTP ────────────────────────────────────────────────────────────
function OTPScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="flex-1 flex flex-col justify-center px-6 gap-8">
        <div className="flex flex-col items-center gap-4">
          <div style={{ width: 48, height: 48, background: C.primary, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>S</span>
          </div>
          <div className="text-center">
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>Check your email</h1>
            <p style={{ fontSize: 16, color: C.textMuted, marginTop: 8 }}>We sent a 6-digit code to<br />student@norquest.ca</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4" style={{ height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <Key size={20} color={C.textMuted} />
            <span className="flex-1 text-center" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 8, color: C.textPrimary }}>1 2 3 4 5 6</span>
            <div style={{ width: 18, height: 18, border: `2px solid ${C.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
          <button onClick={onNext} className="flex items-center justify-center gap-2" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
            Verify <ArrowRight size={20} color="#fff" />
          </button>
          <button onClick={onBack} style={{ fontSize: 14, fontWeight: 600, color: C.primary, textAlign: "center", padding: "8px 0" }}>Back to Email</button>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ─── Shared Onboarding nav header ────────────────────────────────────────────
function OnboardHeader({ step, onBack }: { step: 1 | 2 | 3 | 4; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      <button onClick={onBack} style={{ width: 40, height: 40, border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ChevronLeft size={20} color={C.textPrimary} />
      </button>
      <div className="flex-1" style={{ height: 4, background: C.muted, borderRadius: 99 }}>
        <div style={{ width: `${step * 25}%`, height: "100%", background: C.primary, borderRadius: 99, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{step}/4</span>
    </div>
  );
}

// ─── Screen 3: Onboarding Step 1 ─────────────────────────────────────────────
function Onboard1Screen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [selected, setSelected] = useState("norquest");
  const schools = [
    { id: "norquest", name: "NorQuest College", available: true },
    { id: "uofa", name: "University of Alberta", available: false },
    { id: "macewan", name: "MacEwan University", available: false },
  ];
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <OnboardHeader step={1} onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-4 gap-6 overflow-y-auto">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>Select your School</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginTop: 8 }}>Find your campus community. Choose your school to start connecting.</p>
        </div>
        <div className="flex flex-col gap-3">
          {schools.map(school => {
            const isSelected = selected === school.id;
            return (
              <button key={school.id} onClick={() => school.available && setSelected(school.id)} className="flex items-center justify-between px-4" style={{ height: 56, borderRadius: 12, border: isSelected ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`, background: isSelected ? "rgba(37,99,235,0.05)" : school.available ? C.bg : "rgba(255,255,255,0.5)" }}>
                <span style={{ fontSize: 16, fontWeight: isSelected ? 700 : 600, color: isSelected ? C.primary : C.textMuted }}>{school.name}</span>
                {school.available ? <ArrowRight size={20} color={isSelected ? C.primary : C.border} /> : <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.muted, padding: "3px 10px", borderRadius: 99 }}>Coming Soon</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={onNext} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Continue <ArrowRight size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

// ─── Screen 4: Onboarding Step 2 ─────────────────────────────────────────────
function Onboard2Screen({ onNext, onBack, profile, setProfile }: { onNext: () => void; onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [major, setMajor] = useState(profile.major);
  const [year, setYear] = useState(profile.year);
  const [showDropdown, setShowDropdown] = useState(false);
  const suggestions = ["Computer Science", "Computer Engineering Technology", "Computer Information Systems"];
  const filtered = suggestions.filter(s => s.toLowerCase().includes(major.toLowerCase()) && s !== major);

  const save = () => {
    setProfile({ ...profile, major, year });
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <OnboardHeader step={2} onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-3 gap-5 overflow-y-auto">
        <div className="flex">
          <span style={{ background: C.primary, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99 }}>NorQuest College</span>
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>{"What's your Major?"}</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginTop: 6 }}>Your program and year. Used to find shared classes.</p>
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 px-4" style={{ height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <BookOpen size={20} color={C.textMuted} />
            <input value={major} onChange={e => { setMajor(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} className="flex-1 outline-none bg-transparent" style={{ fontSize: 16, color: C.textPrimary }} />
          </div>
          {showDropdown && filtered.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, zIndex: 10 }}>
              {filtered.map((s, i) => (
                <button key={s} className="flex items-center justify-between w-full px-4 py-3" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }} onClick={() => { setMajor(s); setShowDropdown(false); }}>
                  <span style={{ fontSize: 15, color: C.textPrimary }}>{s}</span>
                  <ChevronLeft size={16} color={C.textMuted} style={{ transform: "rotate(180deg)" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>Year of Study</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, "5+"].map((y, i) => {
              const val = i + 1;
              const isSelected = year === val;
              return (
                <button key={y} onClick={() => setYear(val)} style={{ width: 52, height: 52, borderRadius: 12, border: isSelected ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`, background: isSelected ? "rgba(37,99,235,0.05)" : C.bg, color: isSelected ? C.primary : C.textPrimary, fontSize: 15, fontWeight: 700 }}>
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Next <ArrowRight size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

// ─── Screen 5: Onboarding Step 3 — Image-first course selection ───────────────
function Onboard3Screen({ onNext, onBack, profile, setProfile }: { onNext: () => void; onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [courses, setCourses] = useState(profile.courses);

  const save = () => {
    setProfile({ ...profile, courses });
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <OnboardHeader step={3} onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-4 gap-4 overflow-y-auto">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>Your Classes</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginTop: 6 }}>Upload a photo of your schedule and AI will extract your courses instantly.</p>
        </div>
        <CourseImageParser courses={courses} onChange={setCourses} onConfirm={save} confirmLabel="Next" />
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Next <ArrowRight size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

// ─── Screen 6: Onboarding Step 4 ─────────────────────────────────────────────
const TOKENS = {
  primary: "#2563EB",
  bg: "#FFFFFF",
  border: "#E2E8F0",
  textPrimary: "#020817",
  textMuted: "#64748B",
};

const INTEREST_CATEGORIES = [
  { name: "Academic & Intellectual", items: ["Debate", "History", "Literature", "Logic puzzles", "Philosophy", "Science"] },
  { name: "Arts & Creative", items: ["Creative Writing", "Design", "Film", "Music", "Photography", "Theatre", "Visual Art"] },
  { name: "Career & Professional", items: ["Entrepreneurship", "Finance", "Internships", "Networking", "Public Speaking"] },
  { name: "Community & Culture", items: ["Cultural Identity", "Greek Life", "Language Learning", "Student Government", "Volunteering"] },
  { name: "Food & Drink", items: ["Baking", "Coffee & Tea", "Cooking", "Craft Beer & Wine", "Food Culture", "Nutrition"] },
  { name: "Gaming & Entertainment", items: ["Anime", "Board Games", "Comedy", "Podcasts", "TV Shows", "Gaming"] },
  { name: "Nature & Outdoors", items: ["Camping", "Gardening", "Hiking", "Sustainability", "Wildlife"] },
  { name: "Politics & Society", items: ["Activism", "Current Events", "Economics", "Environmentalism", "Law", "Social Justice"] },
  { name: "Social & Lifestyle", items: ["Coffee Culture", "Dating", "Dining Out", "Fashion", "Nightlife", "Travel"] },
  { name: "Spirituality & Wellness", items: ["Astrology", "Meditation", "Mental Health", "Religion & Faith", "Yoga"] },
  { name: "Sports & Fitness", items: ["Esports", "Gym & Lifting", "Individual Sports", "Martial Arts", "Outdoor & Adventure", "Team Sports"] },
  { name: "Tech & Innovation", items: ["AI", "Coding", "Cybersecurity", "Gadgets", "Robotics", "Startups"] },
];

function InterestTag({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        borderRadius: 99,
        border: `1px solid ${selected ? TOKENS.primary : TOKENS.border}`,
        background: selected ? TOKENS.primary : TOKENS.bg,
        color: selected ? "#FFFFFF" : TOKENS.textPrimary,
        fontSize: 14,
        fontWeight: selected ? 600 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function CategorizedInterests({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const toggle = (label: string) => {
    const next = new Set(selected);
    next.has(label) ? next.delete(label) : next.add(label);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-6">
      {INTEREST_CATEGORIES.map((category) => (
        <div key={category.name}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: TOKENS.textPrimary, textTransform: "capitalize", marginBottom: 8 }}>
            {category.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {category.items.map((label) => (
              <InterestTag key={label} label={label} selected={selected.has(label)} onToggle={() => toggle(label)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Onboard4Screen({ onNext, onBack, profile, setProfile }: { onNext: () => void; onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [selected, setSelected] = useState(new Set(profile.interests));

  const save = () => {
    setProfile({ ...profile, interests: selected });
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <OnboardHeader step={4} onBack={onBack} />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 136 }}>
          <div className="flex flex-col gap-4">
            <div className="flex">
              <span style={{ background: TOKENS.primary, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99 }}>
                NorQuest College
              </span>
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: "-0.5px", lineHeight: "34px" }}>
                What are you into?
              </h1>
              <p style={{ fontSize: 15, color: TOKENS.textMuted, marginTop: 6 }}>
                Pick at least 3. {"We'll"} use these to find your study and social matches.
              </p>
            </div>
            <div className="flex justify-end">
              <span style={{ fontSize: 12, fontWeight: 400, color: TOKENS.textMuted }}>{selected.size} selected</span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <CategorizedInterests selected={selected} onChange={setSelected} />
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
          style={{
            height: 120,
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 24,
            background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 45%)",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={save}
            className="flex items-center justify-center gap-2 w-full"
            style={{ height: 56, background: TOKENS.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, pointerEvents: "auto" }}
          >
            Complete Signup <Check size={20} color="#fff" />
          </button>
        </div>
      </div>

      <HomeIndicator />
    </div>
  );
}

// ─── Screen 7: Dashboard ──────────────────────────────────────────────────────
function DashboardScreen({ onProfileClick, profile }: { onProfileClick: () => void; profile: UserProfile }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      <AppHeader onProfileClick={onProfileClick} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em" }}>NORQUEST COLLEGE · {profile.major.toUpperCase()} · YEAR {profile.year}</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.textPrimary, letterSpacing: "-0.5px", lineHeight: "38px", marginTop: 4 }}>Hey, {profile.name.split(" ")[0]}.</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>{"You're"} enrolled in {profile.courses.length} {profile.courses.length === 1 ? "class" : "classes"} this semester.</p>
        </div>
        <div style={{ background: C.dark, borderRadius: 16, padding: 16 }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div style={{ width: 8, height: 8, background: "#22C55E", borderRadius: "50%" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0081A7", letterSpacing: "0.08em" }}>PROACTIVE SIGNAL</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Exam preparation conflict detected</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6, lineHeight: "18px" }}>You have two midterms scheduled on the same day. {"Let's"} look at study matches.</p>
          <button style={{ marginTop: 14, height: 40, background: "#fff", borderRadius: 8, padding: "0 16px", fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Find Study Matches</button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>Surfaced for You</h2>
              <Sparkles size={16} color={C.primary} />
            </div>
            <button style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>View all</button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { emoji: "📚", emojiBg: "#FFFBEB", type: "ACADEMIC" as const, title: "Study group forming for CMPT 101", sub: "3 classmates from your program joined" },
              { emoji: "🧠", emojiBg: "#FFF1F2", type: "WELLNESS" as const, title: "Stress Management Seminar", sub: "Tomorrow at 2:00 PM - Library" },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-3 p-3" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                <div style={{ width: 44, height: 44, background: item.emojiBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.emoji}</div>
                <div className="flex-1">
                  <CategoryTag type={item.type} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginTop: 3 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.sub}</p>
                </div>
                <ChevronLeft size={16} color={C.textMuted} style={{ transform: "rotate(180deg)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>Top peer match</h2>
            <button style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>See all</button>
          </div>
          <div style={{ background: C.bg, border: "1.5px solid rgba(37,99,235,0.2)", borderRadius: 16, padding: 16 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 48, height: 48, background: C.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>JD</span>
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Jane Doe</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>Computer Science · Year 1</p>
              </div>
              <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "6px 12px" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>92% Match</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {["Shared Class: CMPT 101", "Gaming Interest"].map(tag => (
                <span key={tag} style={{ background: C.muted, border: `1px solid ${C.border}`, borderRadius: 99, padding: "3px 10px", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>NorQuest Resource Hub</h2>
            <button style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>Open hub</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Bell, label: "Academic Success", sub: "5 services", bg: "#EFF6FF" },
              { Icon: Compass, label: "Mental Health", sub: "3 services", bg: "#E0F4F8" },
            ].map(({ Icon, label, sub, bg }) => (
              <div key={label} className="flex flex-col gap-2 p-4" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16 }}>
                <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={C.primary} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{label}</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen 8: Events ─────────────────────────────────────────────────────────
const EVENT_DATA = [
  { month: "JUN", day: "24", type: "CAREER" as const, title: "Cybersecurity Career Fair", time: "10:00 AM - 2:00 PM", place: "Heritage Hall", going: 12 },
  { month: "JUN", day: "20", type: "ACADEMIC" as const, title: "CMPT 101 Study Jam", time: "Today, 6:00 PM", place: "Library Room 204", going: 5 },
  { month: "JUN", day: "21", type: "WELLNESS" as const, title: "Midterm Stress Relief Yoga", time: "Tomorrow, 2:00 PM", place: "Wellness Centre", going: 8 },
  { month: "JUN", day: "26", type: "SOCIAL" as const, title: "Anime Club Movie Night", time: "Fri, 7:00 PM", place: "Student Lounge", going: 20 },
];

function EventsScreen({ onProfileClick }: { onProfileClick: () => void }) {
  const [filter, setFilter] = useState("All");
  const [rsvps, setRsvps] = useState(new Set(["CMPT 101 Study Jam"]));
  const categories = ["All", "Academic", "Social", "Wellness", "Career"];
  const filtered = filter === "All" ? EVENT_DATA : EVENT_DATA.filter(e => e.type === filter.toUpperCase());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      <AppHeader onProfileClick={onProfileClick} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px" }}>Campus Events</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginTop: 4 }}>Discover what&apos;s happening at NorQuest this week.</p>
        </div>
        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0, background: filter === cat ? C.primary : C.bg, border: filter === cat ? "none" : `1px solid ${C.border}`, color: filter === cat ? "#fff" : C.textMuted, fontSize: 14, fontWeight: 700 }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {filtered.map(ev => {
            const isGoing = rsvps.has(ev.title);
            return (
              <div key={ev.title} className="flex gap-3 p-4" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16 }}>
                <div style={{ width: 56, height: 56, background: C.muted, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.05em" }}>{ev.month}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary }}>{ev.day}</span>
                </div>
                <div className="flex-1">
                  <CategoryTag type={ev.type} />
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginTop: 4 }}>{ev.title}</p>
                  <div className="flex items-center gap-1 mt-2"><Clock size={12} color={C.textMuted} /><span style={{ fontSize: 13, color: C.textMuted }}>{ev.time}</span></div>
                  <div className="flex items-center gap-1 mt-0.5"><MapPin size={12} color={C.textMuted} /><span style={{ fontSize: 13, color: C.textMuted }}>{ev.place}</span></div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: `hsl(${210 + i * 20},70%,60%)`, border: "2px solid #fff", marginLeft: i ? -6 : 0 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: C.textMuted }}>+{ev.going} going</span>
                    </div>
                    <button onClick={() => { const n = new Set(rsvps); isGoing ? n.delete(ev.title) : n.add(ev.title); setRsvps(n); }} style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: isGoing ? "#ECFDF5" : C.bg, border: isGoing ? "none" : `1px solid ${C.primary}`, color: isGoing ? "#047857" : C.primary, display: "flex", alignItems: "center", gap: 4 }}>
                      {isGoing && <Check size={14} color="#047857" />}
                      {isGoing ? "Going" : "RSVP"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Screen 9: Matches ────────────────────────────────────────────────────────
const MATCH_DATA = [
  { initials: "AM", name: "Alex Morgan", major: "Software Development • Year 2", score: 88, interests: ["Python", "AI", "Gaming"], pending: false },
  { initials: "SL", name: "Sarah Lee", major: "Computer Science • Year 1", score: 95, interests: ["React", "Music", "Gaming"], pending: true },
  { initials: "KP", name: "Kyle Park", major: "Computer Science • Year 2", score: 81, interests: ["Gaming", "Anime", "Coding"], pending: false },
];

function MatchesScreen({ onProfileClick }: { onProfileClick: () => void }) {
  const [states, setStates] = useState<Record<string, "default" | "pending" | "ignored">>(
    Object.fromEntries(MATCH_DATA.map(m => [m.name, m.pending ? "pending" : "default"]))
  );
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      <AppHeader onProfileClick={onProfileClick} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px" }}>Student Matches</h1>
        <p style={{ fontSize: 15, color: C.textMuted, marginTop: 4, marginBottom: 16 }}>Connect with peers at NorQuest College based on shared interests and majors.</p>
        <div className="flex flex-col gap-3">
          {MATCH_DATA.filter(m => states[m.name] !== "ignored").map(match => {
            const state = states[match.name];
            return (
              <div key={match.name} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 48, height: 48, background: C.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{match.initials}</span>
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{match.name}</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{match.major}</p>
                  </div>
                  <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "5px 10px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{match.score}% Match</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Shared Interests:</span>
                  {match.interests.map(t => (
                    <span key={t} style={{ background: C.muted, border: `1px solid ${C.border}`, borderRadius: 99, padding: "2px 9px", fontSize: 12, color: C.textMuted }}>{t}</span>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStates(s => ({ ...s, [match.name]: state === "pending" ? "default" : "pending" }))} className="flex-1 flex items-center justify-center gap-1.5" style={{ height: 40, borderRadius: 10, background: state === "pending" ? C.muted : C.primary, fontSize: 14, fontWeight: 700, color: state === "pending" ? C.textMuted : "#fff" }}>
                    {state === "pending" ? <UserCheck size={16} color={C.textMuted} /> : <Heart size={16} color="#fff" />}
                    {state === "pending" ? "Pending" : "Connect"}
                  </button>
                  <button onClick={() => setStates(s => ({ ...s, [match.name]: "ignored" }))} className="flex-1 flex items-center justify-center gap-1.5" style={{ height: 40, borderRadius: 10, background: C.muted, border: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.textMuted }}>
                    <X size={16} color={C.textMuted} /> Ignore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Screen 10: Resources ─────────────────────────────────────────────────────
const RESOURCES = [
  { Icon: Bell, label: "Academic Success", sub: "5 services", bg: "#EFF6FF" },
  { Icon: Compass, label: "Mental Health", sub: "3 services", bg: "#E0F4F8" },
  { Icon: DollarSign, label: "Financial Aid", sub: "4 services", bg: "#ECFDF5" },
  { Icon: Briefcase, label: "Career Services", sub: "6 services", bg: "#FFFBEB" },
  { Icon: Globe, label: "International Students", sub: "2 services", bg: "#EFF6FF" },
  { Icon: GraduationCap, label: "Accessibility Services", sub: "3 services", bg: "#FFF1F2" },
  { Icon: Laptop, label: "IT Help Desk", sub: "1 service", bg: C.muted },
  { Icon: BookOpen, label: "Library & Learning", sub: "7 services", bg: "#E0F4F8" },
];

function ResourcesScreen({ onProfileClick }: { onProfileClick: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      <AppHeader onProfileClick={onProfileClick} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.5px" }}>Resource Hub</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginTop: 4 }}>Support services at NorQuest, organized for you.</p>
        </div>
        <div className="flex items-center gap-3 px-4" style={{ height: 48, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <Search size={20} color={C.textMuted} />
          <input placeholder="Search for a service..." className="flex-1 outline-none bg-transparent" style={{ fontSize: 15, color: C.textPrimary }} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Recommended for you</h2>
            <Sparkles size={15} color={C.primary} />
          </div>
          <div className="flex items-center gap-3 p-4" style={{ background: C.bg, border: "1.5px solid rgba(37,99,235,0.2)", borderRadius: 16 }}>
            <div style={{ width: 40, height: 40, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GraduationCap size={20} color={C.primary} />
            </div>
            <div className="flex-1">
              <p style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Academic Coaching Drop-In</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>Suggested based on your midterm conflict</p>
            </div>
            <ChevronLeft size={16} color={C.textMuted} style={{ transform: "rotate(180deg)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-4">
          {RESOURCES.map(({ Icon, label, sub, bg }) => (
            <button key={label} className="flex flex-col gap-2 p-4 text-left" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16 }}>
              <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color={C.primary} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: "18px" }}>{label}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profile sub-screens ──────────────────────────────────────────────────────

function EditNameScreen({ onBack, profile, setProfile }: { onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [value, setValue] = useState(profile.name);
  const save = () => { setProfile({ ...profile, name: value }); onBack(); };
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <SubScreenHeader title="Edit Name" onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-8 gap-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>{"What's"} your name?</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>{"This is how you'll appear to other students."}</p>
        </div>
        <div className="flex items-center gap-3 px-4" style={{ height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <User size={20} color={C.textMuted} />
          <input value={value} onChange={e => setValue(e.target.value)} className="flex-1 outline-none bg-transparent" style={{ fontSize: 16, color: C.textPrimary }} placeholder="Your full name" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Save Name <Check size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

function EditYearScreen({ onBack, profile, setProfile }: { onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [year, setYear] = useState(profile.year);
  const save = () => { setProfile({ ...profile, year }); onBack(); };
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <SubScreenHeader title="Update Year" onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-8 gap-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>Year of Study</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>Select your current year. This helps us surface relevant matches.</p>
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((y) => {
            const isSelected = year === y;
            return (
              <button key={y} onClick={() => setYear(y)} className="flex items-center justify-between px-4" style={{ height: 56, borderRadius: 12, border: isSelected ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`, background: isSelected ? "rgba(37,99,235,0.05)" : C.bg }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: isSelected ? C.primary : C.textPrimary }}>Year {y === 5 ? "5+" : y}</span>
                {isSelected && <Check size={18} color={C.primary} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Save Year <Check size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

function EditMajorScreen({ onBack, profile, setProfile }: { onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [major, setMajor] = useState(profile.major);
  const [showDropdown, setShowDropdown] = useState(false);
  const suggestions = ["Computer Science", "Computer Engineering Technology", "Computer Information Systems", "Business Administration", "Health Care Aide", "Early Childhood Education"];
  const filtered = suggestions.filter(s => s.toLowerCase().includes(major.toLowerCase()) && s !== major);
  const save = () => { setProfile({ ...profile, major }); onBack(); };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <SubScreenHeader title="Change Major" onBack={onBack} />
      <div className="flex-1 flex flex-col px-6 pt-8 gap-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>{"What's"} your program?</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>Used to match you with classmates in the same program.</p>
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 px-4" style={{ height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <BookOpen size={20} color={C.textMuted} />
            <input value={major} onChange={e => { setMajor(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} className="flex-1 outline-none bg-transparent" style={{ fontSize: 16, color: C.textPrimary }} placeholder="Search programs..." />
            {major && <button onClick={() => { setMajor(""); setShowDropdown(false); }}><X size={16} color={C.textMuted} /></button>}
          </div>
          {showDropdown && filtered.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, zIndex: 10 }}>
              {filtered.map((s, i) => (
                <button key={s} className="flex items-center justify-between w-full px-4 py-3" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }} onClick={() => { setMajor(s); setShowDropdown(false); }}>
                  <span style={{ fontSize: 15, color: C.textPrimary }}>{s}</span>
                  <Check size={16} color={C.primary} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Save Program <Check size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

function ManageCoursesScreen({ onBack, profile, setProfile }: { onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [courses, setCourses] = useState(profile.courses);
  const save = () => { setProfile({ ...profile, courses }); onBack(); };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <SubScreenHeader title="Manage Courses" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 flex flex-col gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>Your Courses</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>Upload a new schedule image to add or update your enrolled courses.</p>
        </div>
        <CourseImageParser courses={courses} onChange={setCourses} onConfirm={save} confirmLabel="Save Courses" />
      </div>
      <div className="px-6 pb-6 pt-2">
        <button onClick={save} className="flex items-center justify-center gap-2 w-full" style={{ height: 56, background: C.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Save Courses <Check size={20} color="#fff" />
        </button>
        <HomeIndicator />
      </div>
    </div>
  );
}

function EditInterestsScreen({ onBack, profile, setProfile }: { onBack: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const [selected, setSelected] = useState(new Set(profile.interests));
  const save = () => { setProfile({ ...profile, interests: selected }); onBack(); };

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <SubScreenHeader title="Edit Interests" onBack={onBack} />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 136 }}>
          <div className="flex flex-col gap-4">
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: TOKENS.textPrimary }}>What are you into?</h1>
              <p style={{ fontSize: 14, color: TOKENS.textMuted, marginTop: 4 }}>Updating your interests refreshes your peer matches.</p>
            </div>
            <div className="flex justify-end">
              <span style={{ fontSize: 12, fontWeight: 400, color: TOKENS.textMuted }}>{selected.size} selected</span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <CategorizedInterests selected={selected} onChange={setSelected} />
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
          style={{
            height: 120,
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 24,
            background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 45%)",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={save}
            className="flex items-center justify-center gap-2 w-full"
            style={{ height: 56, background: TOKENS.primary, borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, pointerEvents: "auto" }}
          >
            Save Changes <Check size={20} color="#fff" />
          </button>
        </div>
      </div>

      <HomeIndicator />
    </div>
  );
}

// ─── Screen 11: Profile ───────────────────────────────────────────────────────
function ProfileScreen({
  onBack, profile, setProfile, onNavigate,
}: {
  onBack: () => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onNavigate: (s: Screen) => void;
}) {
  const [discoveryOn, setDiscoveryOn] = useState(true);
  const initials = profile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const options: { Icon: typeof User; label: string; dest: Screen; danger?: boolean }[] = [
    { Icon: User, label: "Edit Name", dest: "edit-name" },
    { Icon: Calendar, label: "Update Year", dest: "edit-year" },
    { Icon: GraduationCap, label: "Change Major", dest: "edit-major" },
    { Icon: BookOpen, label: "Manage Courses", dest: "manage-courses" },
    { Icon: Heart, label: "Edit Interests", dest: "edit-interests" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      <div className="flex items-center px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={22} color={C.textPrimary} />
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginLeft: 4 }}>Profile</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center py-8 gap-3">
          <div style={{ width: 80, height: 80, background: C.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{initials}</span>
          </div>
          <div className="text-center">
            <p style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary }}>{profile.name}</p>
            <p style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>NorQuest College · {profile.major} · Year {profile.year}</p>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {options.map(({ Icon, label, dest }) => (
            <button
              key={label}
              onClick={() => onNavigate(dest)}
              className="flex items-center justify-between w-full px-5 py-4"
              style={{ borderBottom: `1px solid ${C.border}`, background: C.bg, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = C.muted)}
              onMouseLeave={e => (e.currentTarget.style.background = C.bg)}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} color={C.textMuted} />
                <span style={{ fontSize: 16, color: C.textPrimary }}>{label}</span>
              </div>
              <ChevronLeft size={18} color={C.textMuted} style={{ transform: "rotate(180deg)" }} />
            </button>
          ))}
          <button
            onClick={() => onNavigate("signin")}
            className="flex items-center justify-between w-full px-5 py-4"
            style={{ borderBottom: `1px solid ${C.border}`, background: C.bg, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#FFF1F2")}
            onMouseLeave={e => (e.currentTarget.style.background = C.bg)}
          >
            <div className="flex items-center gap-3">
              <LogOut size={20} color="#EF4444" />
              <span style={{ fontSize: 16, color: "#EF4444" }}>Sign Out</span>
            </div>
            <ChevronLeft size={18} color="#EF4444" style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Compass size={20} color={C.textMuted} />
              <div>
                <p style={{ fontSize: 16, color: C.textPrimary }}>Discovery Mode</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>Appear in peer matches</p>
              </div>
            </div>
            <button
              onClick={() => setDiscoveryOn(!discoveryOn)}
              style={{ width: 51, height: 31, borderRadius: 99, background: discoveryOn ? C.primary : C.muted, position: "relative", transition: "background 0.2s, opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <div style={{ position: "absolute", top: 3, left: discoveryOn ? 23 : 3, width: 25, height: 25, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("signin");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<UserProfile>({
    name: "David Chen",
    major: "Computer Science",
    year: 1,
    courses: ["CMPT 101", "MATH 120", "ENGL 102"],
    interests: new Set(["Gaming", "Anime", "Music", "Coding"]),
  });

  const isMainApp = ["dashboard", "events", "matches", "resources"].includes(screen);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setScreen(tab);
  };

  // Profile sub-screens navigate back to the profile screen
  const profileSubScreens: Screen[] = ["edit-name", "edit-year", "edit-major", "manage-courses", "edit-interests"];
  const isProfileSub = profileSubScreens.includes(screen);

  const renderScreen = () => {
    const profileCb = () => setScreen("profile");
    const backToProfile = () => setScreen("profile");

    switch (screen) {
      case "signin": return <SignInScreen onNext={() => setScreen("otp")} />;
      case "otp": return <OTPScreen onNext={() => setScreen("onboard1")} onBack={() => setScreen("signin")} />;
      case "onboard1": return <Onboard1Screen onNext={() => setScreen("onboard2")} onBack={() => setScreen("otp")} />;
      case "onboard2": return <Onboard2Screen onNext={() => setScreen("onboard3")} onBack={() => setScreen("onboard1")} profile={profile} setProfile={setProfile} />;
      case "onboard3": return <Onboard3Screen onNext={() => setScreen("onboard4")} onBack={() => setScreen("onboard2")} profile={profile} setProfile={setProfile} />;
      case "onboard4": return <Onboard4Screen onNext={() => { setScreen("dashboard"); setActiveTab("dashboard"); }} onBack={() => setScreen("onboard3")} profile={profile} setProfile={setProfile} />;
      case "dashboard": return <DashboardScreen onProfileClick={profileCb} profile={profile} />;
      case "events": return <EventsScreen onProfileClick={profileCb} />;
      case "matches": return <MatchesScreen onProfileClick={profileCb} />;
      case "resources": return <ResourcesScreen onProfileClick={profileCb} />;
      case "profile": return <ProfileScreen onBack={() => setScreen(activeTab)} profile={profile} setProfile={setProfile} onNavigate={setScreen} />;
      case "edit-name": return <EditNameScreen onBack={backToProfile} profile={profile} setProfile={setProfile} />;
      case "edit-year": return <EditYearScreen onBack={backToProfile} profile={profile} setProfile={setProfile} />;
      case "edit-major": return <EditMajorScreen onBack={backToProfile} profile={profile} setProfile={setProfile} />;
      case "manage-courses": return <ManageCoursesScreen onBack={backToProfile} profile={profile} setProfile={setProfile} />;
      case "edit-interests": return <EditInterestsScreen onBack={backToProfile} profile={profile} setProfile={setProfile} />;
      default: return null;
    }
  };

  const allScreens: { id: Screen; label: string }[] = [
    { id: "signin", label: "1" }, { id: "otp", label: "2" },
    { id: "onboard1", label: "3" }, { id: "onboard2", label: "4" },
    { id: "onboard3", label: "5" }, { id: "onboard4", label: "6" },
    { id: "dashboard", label: "🏠" }, { id: "events", label: "📅" },
    { id: "matches", label: "👥" }, { id: "resources", label: "🧭" },
    { id: "profile", label: "👤" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #E0F4F8 100%)", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 393, height: 852, background: C.bg, borderRadius: 48, boxShadow: "0 32px 80px rgba(37,99,235,0.18), 0 0 0 8px #1a1a2e, 0 0 0 11px #2d2d4e", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Notch */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 126, height: 36, background: "#1a1a2e", borderRadius: "0 0 20px 20px", zIndex: 50 }} />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {renderScreen()}
        </div>
        {isMainApp && <BottomTabBar active={activeTab} onChange={handleTabChange} />}
      </div>

      {/* Screen nav pills */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderRadius: 99, padding: "7px 10px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        {allScreens.map(({ id, label }) => {
          const isActive = screen === id || (isProfileSub && id === "profile");
          return (
            <button
              key={id}
              onClick={() => {
                setScreen(id);
                if (["dashboard", "events", "matches", "resources"].includes(id)) setActiveTab(id as Tab);
              }}
              title={id}
              style={{ width: 30, height: 30, borderRadius: "50%", background: isActive ? C.primary : "transparent", color: isActive ? "#fff" : C.textMuted, fontSize: 11, fontWeight: 700, border: isActive ? "none" : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

