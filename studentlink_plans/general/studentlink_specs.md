# StudentLink Technical Specifications & Integrations

This is a living document that tracks the technical specifics, architectural decisions, and integration details of the StudentLink project.

## Current Project Core
- **Framework:** React Native (Expo SDK 54.0.35)
- **Navigation:** Expo Router (File-based)
- **Icons:** `lucide-react-native`
- **Data Management:** Supabase (Primary) + Global StudentContext (Real-time caching)
- **Backend:** Supabase (Auth, Database, Realtime)

## UI & Design System
The project utilizes a custom theme designed to be clean, modern, and high-contrast.

### Color Palette
- **Primary:** `#2563EB` (Action blue)
- **Accent:** `#0081A7` (Secondary brand color)
- **Background:** `#FFFFFF`
- **Surface:** `#FFFFFF` (Cards and elevated elements)
- **Muted:** `#F1F5F9` (Subtle backgrounds)

### Navigation Structure
The app uses a bottom tab navigation for the main experience and a stack for authentication:
- **Auth (Stack):**
    - **Welcome:** Email input with university domain validation (`ualberta.ca`, `mymacewan.ca`, `norquest.ca`). Features **Silent Auth Simulation**.
    - **Onboarding (5-Step Wizard, Steps 2-5 Optional):**
        - **Step 1: Select Institution:** Find school (NorQuest College, MacEwan University, University of Alberta). Currently only NorQuest College is active.
        - **Step 2: Display Name:** Name or nickname input (64 char max) with automatic fallback to email prefix.
        - **Step 3: Studies:** Major/Program input (Title Case normalized) + Year of Study (1st-5+).
        - **Step 4: Your Classes:** Scrollable course selection (UPPERCASE Regex validated, max 7 classes).
        - **Step 5: Interests:** Multi-select interest tags.
- **Main (Tabs):**
    - **Home (Dashboard):** Dynamic feed pulling zero-lag data from global context.
    - **Matches:** Peer-to-peer discovery and messaging (Placeholder).
    - **Resources:** School-specific resource hub (Placeholder).
    - **Profile:** Centralized account management hub. Contains all settings previously in the modal popup.
- **Global Header:** Includes a non-interactive Profile icon for visual branding.
- **Safe Area Management:** Uses `react-native-safe-area-context` to dynamically adjust padding for notches and home indicators, ensuring no overlap with navigation bars.

## Performance & UX Architecture
The application is optimized for an "Instant UI" feel through several advanced patterns:

### 1. Global Pre-fetching & Caching
- **StudentProvider:** A root-level context that initializes a data fetch the moment the app mounts. 
- **Zero-Lag Navigation:** Profile and Dashboard data is pulled from the provider's memory, eliminating loading spinners during screen transitions.
- **Hybrid Search Cache:** Up to 100 majors and 50 popular courses are preloaded per school. Search inputs query this local list first for instant results, hitting the database only for deep searches.

### 2. Optimistic UI Updates
- **Instant Feedback:** Actions like adding/removing courses or updating names update the local UI state immediately.
- **Background Sync:** Database persistence and global dashboard refreshes (via `DeviceEventEmitter`) happen silently in the background.
- **Rollback Logic:** Automatic server-state reversion if a background network request fails.

### 3. Network Optimization
- **Parallel Requests:** Uses `Promise.all` to fetch profile details and course enrollments simultaneously, reducing total latency by ~50%.

## Data Integrity & Validation Rules
### Global Input Whitelist
- **Allowed Characters:** Letters (a-z, A-Z), Numbers (0-9), and Spaces only.

### Major Selection
- **Formatting:** Normalized to **Title Case**.
- **UX:** Scrollable suggestions with `maxHeight` constraints to prevent keyboard overlap.

### Course Selection
- **Formatting:** Normalized to **UPPERCASE**.
- **Validation:** Strict Regex: `<LETTERS (2+)> <SPACE> <3-DIGITS>`.
- **Enrollment Limit:** Users are restricted to a maximum of **7 enrolled courses** to maintain dashboard focus.
- **UX:** Inline "Add" button and loading indicator within the search row.

## Authentication & Security
- **Sign Out:** A 2-step verification process located in the Profile tab to prevent accidental logouts.
- **Stationary Inputs:** Onboarding footers and centered profile dialogs are configured to remain stationary, requiring manual keyboard dismissal for a more stable layout.
- **Keyboard Handling:** All ScrollViews use `keyboardShouldPersistTaps="handled"` to ensure buttons respond on the first touch even when the keyboard is active.

## Testing Personas
(See `src/data/personas.ts` for hardcoded developmental student profiles).

## Active Integrations
| Integration | Status | Notes |
| :--- | :--- | :--- |
| Safe Area Context | Integrated | Dynamic notch/indicator handling |
| Supabase Client | Integrated | Async session persistence |
| DeviceEventEmitter | Integrated | Cross-screen data synchronization |
| Interests Sync | Integrated | Dynamic multi-select interests with Supabase DB sync |

## Technical Debt / Known Issues
- **Assets:** Icons and splash screen in `app.json` still use default placeholders.

