export type SchoolId = "uofa" | "macewan" | "norquest";

export const SCHOOLS: Record<SchoolId, { name: string; short: string; city: string }> = {
  uofa: { name: "University of Alberta", short: "UofA", city: "Edmonton, AB" },
  macewan: { name: "MacEwan University", short: "MacEwan", city: "Edmonton, AB" },
  norquest: { name: "NorQuest College", short: "NorQuest", city: "Edmonton, AB" },
};

export type Resource = {
  id: string;
  title: string;
  category: "Academic Success" | "Mental Health" | "Food Support" | "Financial Aid" | "Career" | "Housing";
  school: SchoolId;
  blurb: string;
  url: string;
};

export type Match = {
  id: string;
  name: string;
  initials: string;
  program: string;
  year: string;
  score: number;
  reasons: string[];
  bio: string;
};

export type Surfaced = {
  id: string;
  tag: string;
  title: string;
  meta: string;
  accent: "primary" | "accent" | "amber" | "rose" | "emerald";
  emoji: string;
};

export type Alert = {
  title: string;
  body: string;
  cta: string;
};

export type Persona = {
  id: string;
  firstName: string;
  fullName: string;
  school: SchoolId;
  program: string;
  year: string;
  greetingSub: string;
  interests: string[];
  supportNeeds: string[];
  alert: Alert | null;
  surfaced: Surfaced[];
  matches: Match[];
};

export const DEFAULT_PERSONA: Persona = {
  id: "student",
  firstName: "Student",
  fullName: "University Student",
  school: "uofa",
  program: "General Studies",
  year: "1st Year",
  greetingSub: "Welcome back to campus.",
  interests: [],
  supportNeeds: [],
  alert: null,
  surfaced: [],
  matches: [],
};

export const PERSONAS: Persona[] = [DEFAULT_PERSONA];

export const RESOURCES: Resource[] = [
  // University of Alberta (uofa) - 4 categories
  {
    id: "uofa-success",
    title: "Academic Success Centre",
    category: "Academic Success",
    school: "uofa",
    blurb: "Workshops and coaching for writing, time management, and study skills.",
    url: "https://www.ualberta.ca/current-students/academic-success-centre/index.html",
  },
  {
    id: "uofa-mental",
    title: "Counselling & Clinical Services",
    category: "Mental Health",
    school: "uofa",
    blurb: "Free mental health support for currently enrolled students.",
    url: "https://www.ualberta.ca/current-students/counselling/index.html",
  },
  {
    id: "uofa-food",
    title: "Campus Food Bank",
    category: "Food Support",
    school: "uofa",
    blurb: "Providing food hampers and supplemental items to the university community.",
    url: "https://www.campusfoodbank.com/",
  },
  {
    id: "uofa-financial",
    title: "Student Financial Support",
    category: "Financial Aid",
    school: "uofa",
    blurb: "Administers scholarships, bursaries, and emergency student loans.",
    url: "https://www.ualberta.ca/current-students/financial-support/index.html",
  },
  
  // MacEwan University (macewan) - 4 categories
  {
    id: "macewan-writing",
    title: "Writing Centre",
    category: "Academic Success",
    school: "macewan",
    blurb: "Support for all stages of the writing process.",
    url: "https://www.macewan.ca/wac",
  },
  {
    id: "macewan-wellness",
    title: "Wellness & Psychological Services",
    category: "Mental Health",
    school: "macewan",
    blurb: "Professional psychological services and mental health support.",
    url: "https://www.macewan.ca/wellness",
  },
  {
    id: "macewan-food",
    title: "SAMU Pantry",
    category: "Food Support",
    school: "macewan",
    blurb: "Student association food hamper service providing emergency food support.",
    url: "https://samu.ca/pantry",
  },
  {
    id: "macewan-financial",
    title: "Financial Aid & Awards",
    category: "Financial Aid",
    school: "macewan",
    blurb: "Information on student loans, bursaries, and scholarship programs.",
    url: "https://www.macewan.ca/financial-aid",
  },
  
  // NorQuest College (norquest) - 4 categories
  {
    id: "norquest-library",
    title: "Library and Learner Services",
    category: "Academic Success",
    school: "norquest",
    blurb: "Tutoring, research help, and study spaces.",
    url: "https://library.norquest.ca",
  },
  {
    id: "norquest-indigenous",
    title: "Indigenous Student Centre",
    category: "Academic Success",
    school: "norquest",
    blurb: "Miyo-pimâtisiwin (living the good life) support and community.",
    url: "https://www.norquest.ca/indigenous",
  },
  {
    id: "norquest-wellness",
    title: "Wellness Centre",
    category: "Mental Health",
    school: "norquest",
    blurb: "Mental health support, counselling services, and personal wellness coaching.",
    url: "https://www.norquest.ca/wellness",
  },
  {
    id: "norquest-financial",
    title: "Financial Aid & Awards",
    category: "Financial Aid",
    school: "norquest",
    blurb: "Information on student loans, scholarships, bursaries, and emergency funding.",
    url: "https://www.norquest.ca/financial-aid",
  },
  {
    id: "norquest-food",
    title: "SANQC Food Care",
    category: "Food Support",
    school: "norquest",
    blurb: "Food hamper and pantry support for students facing food insecurity.",
    url: "https://sanqc.ca/food-support",
  }
];
