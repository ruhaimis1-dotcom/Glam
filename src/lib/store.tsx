import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { ReviewCriterion } from "@/data/mock";

/* ---------- Types (mirror future DB tables) ---------- */

export interface PrivacyPrefs {
  femaleOnly: boolean;
  privateRoom: boolean;
  noPhoto: boolean;
  noMarketingUse: boolean;
}

export const DEFAULT_PRIVACY: PrivacyPrefs = {
  femaleOnly: true,
  privateRoom: false,
  noPhoto: true,
  noMarketingUse: true,
};

export type BookingStatus = "upcoming" | "completed" | "cancelled";

export interface Booking {
  id: string;
  salonId: string;
  serviceId: string;
  staffId: string;
  dateIso: string;
  dayLabel: string;
  time: string;
  privacy: PrivacyPrefs;
  total: number;
  deposit: number;
  status: BookingStatus;
  createdAt: string;
  reviewed?: boolean;
}

export interface WaitlistEntry {
  id: string;
  salonId: string;
  serviceId: string;
  dateIso: string;
  dayLabel: string;
  preferredTimes: string[];
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  salonId: string;
  scores: Record<ReviewCriterion, number>;
  text: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  audience: number;
  offer: string;
  createdAt: string;
}

export interface Profile {
  name: string;
  area: string;
  phone: string;
  privacy: PrivacyPrefs;
}

interface State {
  hydrated: boolean;
  profile: Profile;
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  reviews: Review[];
  campaigns: Campaign[];
  favorites: string[];
}

type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "addBooking"; booking: Booking }
  | { type: "cancelBooking"; id: string }
  | { type: "completeBooking"; id: string }
  | { type: "addWaitlist"; entry: WaitlistEntry }
  | { type: "removeWaitlist"; id: string }
  | { type: "addReview"; review: Review }
  | { type: "addCampaign"; campaign: Campaign }
  | { type: "toggleFavorite"; salonId: string }
  | { type: "updateProfile"; profile: Partial<Profile> }
  | { type: "reset" };

const seedBookings: Booking[] = [
  {
    id: "GS-1042",
    salonId: "sakina",
    serviceId: "s15",
    staffId: "t10",
    dateIso: "2026-08-21",
    dayLabel: "الجمعة 21 أغسطس",
    time: "16:00",
    privacy: { ...DEFAULT_PRIVACY, privateRoom: true },
    total: 380,
    deposit: 80,
    status: "completed",
    createdAt: "2026-08-18T10:00:00Z",
  },
  {
    id: "GS-1077",
    salonId: "nailbar",
    serviceId: "s5",
    staffId: "t4",
    dateIso: "2026-08-30",
    dayLabel: "الأحد 30 أغسطس",
    time: "19:00",
    privacy: DEFAULT_PRIVACY,
    total: 120,
    deposit: 30,
    status: "completed",
    createdAt: "2026-08-28T10:00:00Z",
    reviewed: true,
  },
];

const initialState: State = {
  hydrated: false,
  profile: { name: "سارة", area: "شمال الرياض", phone: "05XXXXXXXX", privacy: DEFAULT_PRIVACY },
  bookings: seedBookings,
  waitlist: [],
  reviews: [],
  campaigns: [],
  favorites: ["lumiere"],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state, hydrated: true };
    case "addBooking":
      return { ...state, bookings: [action.booking, ...state.bookings] };
    case "cancelBooking":
      return { ...state, bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, status: "cancelled" } : b)) };
    case "completeBooking":
      return { ...state, bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, status: "completed" } : b)) };
    case "addWaitlist":
      return { ...state, waitlist: [action.entry, ...state.waitlist] };
    case "removeWaitlist":
      return { ...state, waitlist: state.waitlist.filter((w) => w.id !== action.id) };
    case "addReview":
      return {
        ...state,
        reviews: [action.review, ...state.reviews],
        bookings: state.bookings.map((b) => (b.id === action.review.bookingId ? { ...b, reviewed: true } : b)),
      };
    case "addCampaign":
      return { ...state, campaigns: [action.campaign, ...state.campaigns] };
    case "toggleFavorite":
      return {
        ...state,
        favorites: state.favorites.includes(action.salonId)
          ? state.favorites.filter((f) => f !== action.salonId)
          : [...state.favorites, action.salonId],
      };
    case "updateProfile":
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case "reset":
      return { ...initialState, hydrated: true };
    default:
      return state;
  }
}

const STORAGE_KEY = "glam-saudi-v1";

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function GlamProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "hydrate", state: raw ? (JSON.parse(raw) as Partial<State>) : {} });
    } catch {
      dispatch({ type: "hydrate", state: {} });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _h, ...persist } = state;
    void _h;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlam() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlam must be used within GlamProvider");
  return ctx;
}

export function newId(prefix: string) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}
