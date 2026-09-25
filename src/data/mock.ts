/**
 * Glam Saudi — structured mock data.
 * Shapes mirror the intended PostgreSQL schema (salons, services, staff,
 * bookings, reviews) so a later Supabase hookup is a swap, not a rewrite.
 */

export type CategoryId = "hair" | "nails" | "makeup" | "skin" | "spa" | "home" | "bridal";
export type IntentId = "occasion" | "routine" | "try" | "now" | "photo";
export type Area = "شمال الرياض" | "شرق الرياض" | "غرب الرياض" | "وسط الرياض" | "جنوب الرياض";

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
}
export interface Intent {
  id: IntentId;
  label: string;
  hint: string;
  emoji: string;
}

export interface Service {
  id: string;
  salonId: string;
  name: string;
  category: CategoryId;
  price: number; // SAR
  durationMin: number;
  deposit: number; // SAR
  popular?: boolean;
}

export interface Staff {
  id: string;
  salonId: string;
  name: string;
  title: string;
  rating: number;
  reviews: number;
  specialties: CategoryId[];
  initials: string;
}

export interface PortfolioItem {
  id: string;
  label: string;
  tone: string;
}

export interface SalonReview {
  id: string;
  salonId: string;
  author: string;
  date: string;
  overall: number;
  scores: Record<ReviewCriterion, number>;
  text: string;
}

export type ReviewCriterion =
  "service" | "punctuality" | "cleanliness" | "result" | "treatment" | "photoMatch" | "priceMatch";

export const REVIEW_CRITERIA: { id: ReviewCriterion; label: string }[] = [
  { id: "service", label: "الخدمة" },
  { id: "punctuality", label: "الالتزام بالوقت" },
  { id: "cleanliness", label: "النظافة" },
  { id: "result", label: "النتيجة" },
  { id: "treatment", label: "التعامل" },
  { id: "photoMatch", label: "مطابقة الصورة" },
  { id: "priceMatch", label: "مطابقة السعر" },
];

export interface Salon {
  id: string;
  name: string;
  tagline: string;
  area: Area;
  district: string;
  rating: number;
  reviews: number;
  priceFrom: number;
  categories: CategoryId[];
  nextSlot: string; // human label
  availableToday: boolean;
  privacy: { femaleOnly: boolean; privateRoom: boolean; noPhoto: boolean; noMarketingUse: boolean };
  verified: boolean;
  tone: string; // gradient tone class for cover
  cancellationPolicy: string;
  hours: string;
  mapHint: string;
  portfolio: PortfolioItem[];
  homeService?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: "hair", label: "شعر", emoji: "💇🏻‍♀️" },
  { id: "nails", label: "أظافر", emoji: "💅🏻" },
  { id: "makeup", label: "مكياج", emoji: "💄" },
  { id: "skin", label: "بشرة", emoji: "✨" },
  { id: "spa", label: "سبا", emoji: "🧖🏻‍♀️" },
  { id: "home", label: "خدمة منزلية", emoji: "🏠" },
  { id: "bridal", label: "عروس", emoji: "👰🏻‍♀️" },
];

export const INTENTS: Intent[] = [
  { id: "occasion", label: "عندي مناسبة", hint: "نرتّب لك لوك كامل بوقت مضمون", emoji: "🎉" },
  { id: "routine", label: "عناية دورية", hint: "خبيرتك المعتادة، وقتك المعتاد", emoji: "🗓️" },
  { id: "try", label: "أبغى أجرب", hint: "أشياء جديدة بتقييمات موثوقة", emoji: "🌸" },
  { id: "now", label: "أحتاج الآن", hint: "أقرب موعد شاغر حولك", emoji: "⚡" },
  { id: "photo", label: "عندي إلهام", hint: "نساعدك تلاقين اللوك الأقرب لذوقك", emoji: "📷" },
];

const cover = (t: string) => t;

export const SALONS: Salon[] = [
  {
    id: "lumiere",
    name: "لوميير ستوديو",
    tagline: "بالاياج وصبغات راقية بلمسة باريسية",
    area: "شمال الرياض",
    district: "حي الملقا",
    rating: 4.9,
    reviews: 312,
    priceFrom: 180,
    categories: ["hair", "makeup"],
    nextSlot: "اليوم 5:30 م",
    availableToday: true,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-plum to-rose"),
    cancellationPolicy: "إلغاء مجاني حتى 24 ساعة قبل الموعد. بعدها يُخصم العربون.",
    hours: "10:00 ص – 11:00 م",
    mapHint: "طريق أنس بن مالك، بجوار بوليفارد الملقا",
    portfolio: [
      { id: "p1", label: "بالاياج كراميل", tone: "from-rose-gold to-rose-soft" },
      { id: "p2", label: "قص طبقات", tone: "from-plum to-rose" },
      { id: "p3", label: "لون عسلي", tone: "from-warning to-rose-gold" },
      { id: "p4", label: "مكياج سهرة", tone: "from-plum-deep to-plum" },
    ],
  },
  {
    id: "nailbar",
    name: "نيل بار الرياض",
    tagline: "جل، أكريليك، وتصاميم فنية",
    area: "شمال الرياض",
    district: "حي حطين",
    rating: 4.7,
    reviews: 208,
    priceFrom: 90,
    categories: ["nails"],
    nextSlot: "اليوم 7:00 م",
    availableToday: true,
    privacy: { femaleOnly: true, privateRoom: false, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-rose to-rose-soft"),
    cancellationPolicy: "إلغاء مجاني حتى 12 ساعة قبل الموعد.",
    hours: "11:00 ص – 12:00 ص",
    mapHint: "شارع الأمير محمد بن سلمان",
    portfolio: [
      { id: "p1", label: "فرنش كلاسيك", tone: "from-cream to-rose-soft" },
      { id: "p2", label: "كروم روز جولد", tone: "from-rose-gold to-cream" },
      { id: "p3", label: "نيود مينيمال", tone: "from-rose-soft to-cream" },
    ],
  },
  {
    id: "velvet",
    name: "فيلفت سكن كلينك",
    tagline: "عناية بشرة طبية وتنظيف عميق",
    area: "شرق الرياض",
    district: "حي الروضة",
    rating: 4.8,
    reviews: 156,
    priceFrom: 250,
    categories: ["skin", "spa"],
    nextSlot: "غدًا 11:00 ص",
    availableToday: false,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-cream to-rose-soft"),
    cancellationPolicy: "إلغاء مجاني حتى 48 ساعة قبل الموعد لجلسات البشرة.",
    hours: "9:00 ص – 9:00 م",
    mapHint: "طريق خالد بن الوليد",
    portfolio: [
      { id: "p1", label: "هيدرافيشل", tone: "from-rose-soft to-cream" },
      { id: "p2", label: "تقشير لطيف", tone: "from-cream to-rose-gold" },
    ],
  },
  {
    id: "noor",
    name: "نور بيوتي لاونج",
    tagline: "مكياج مناسبات وتسريحات",
    area: "غرب الرياض",
    district: "حي العقيق",
    rating: 4.6,
    reviews: 94,
    priceFrom: 150,
    categories: ["makeup", "hair", "bridal"],
    nextSlot: "اليوم 9:00 م",
    availableToday: true,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: false, noMarketingUse: true },
    verified: false,
    tone: cover("from-plum-deep to-plum"),
    cancellationPolicy: "إلغاء مجاني حتى 24 ساعة قبل الموعد.",
    hours: "12:00 م – 12:00 ص",
    mapHint: "طريق الملك فهد الفرعي",
    portfolio: [
      { id: "p1", label: "سموكي ناعم", tone: "from-plum to-plum-deep" },
      { id: "p2", label: "تسريحة سهرة", tone: "from-rose to-plum" },
      { id: "p3", label: "لوك عروس", tone: "from-cream to-rose" },
    ],
  },
  {
    id: "sakina",
    name: "سكينة سبا",
    tagline: "مساج، حمام مغربي، واسترخاء",
    area: "وسط الرياض",
    district: "حي العليا",
    rating: 4.9,
    reviews: 421,
    priceFrom: 220,
    categories: ["spa", "skin"],
    nextSlot: "غدًا 2:00 م",
    availableToday: false,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-rose-gold to-cream"),
    cancellationPolicy: "إلغاء مجاني حتى 24 ساعة. التأخر أكثر من 15 دقيقة يُقصّر الجلسة.",
    hours: "10:00 ص – 10:00 م",
    mapHint: "شارع التحلية",
    portfolio: [
      { id: "p1", label: "حمام مغربي", tone: "from-rose-gold to-cream" },
      { id: "p2", label: "مساج بالأحجار", tone: "from-plum to-rose-gold" },
    ],
  },
  {
    id: "athome",
    name: "غلام هوم — خدمة منزلية",
    tagline: "خبيرات معتمدات إلى باب بيتك",
    area: "شمال الرياض",
    district: "تغطية شمال وشرق الرياض",
    rating: 4.7,
    reviews: 178,
    priceFrom: 200,
    categories: ["home", "hair", "nails", "makeup"],
    nextSlot: "اليوم 6:00 م",
    availableToday: true,
    homeService: true,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-rose to-rose-gold"),
    cancellationPolicy: "إلغاء مجاني حتى 6 ساعات قبل الموعد. رسوم انتقال 40 ر.س تُضاف للفاتورة.",
    hours: "9:00 ص – 11:00 م",
    mapHint: "خدمة متنقلة",
    portfolio: [
      { id: "p1", label: "مكياج منزلي", tone: "from-rose to-rose-soft" },
      { id: "p2", label: "مناكير منزلي", tone: "from-cream to-rose" },
    ],
  },
  {
    id: "bride",
    name: "أتيليه العروس",
    tagline: "باقات عروس متكاملة مع بروفة",
    area: "شمال الرياض",
    district: "حي النرجس",
    rating: 4.8,
    reviews: 67,
    priceFrom: 1800,
    categories: ["bridal", "makeup", "hair"],
    nextSlot: "الخميس 4:00 م",
    availableToday: false,
    privacy: { femaleOnly: true, privateRoom: true, noPhoto: true, noMarketingUse: true },
    verified: true,
    tone: cover("from-cream to-rose-gold"),
    cancellationPolicy: "عربون 30% غير مسترد لباقات العروس. تغيير الموعد مرة واحدة مجانًا.",
    hours: "بموعد مسبق",
    mapHint: "طريق الملك سلمان",
    portfolio: [
      { id: "p1", label: "عروس كلاسيك", tone: "from-cream to-rose-soft" },
      { id: "p2", label: "عروس نجدية", tone: "from-rose-gold to-plum" },
      { id: "p3", label: "بروفة مكياج", tone: "from-rose-soft to-rose" },
    ],
  },
];

export const SERVICES: Service[] = [
  // lumiere
  {
    id: "s1",
    salonId: "lumiere",
    name: "بالاياج كامل",
    category: "hair",
    price: 650,
    durationMin: 180,
    deposit: 100,
    popular: true,
  },
  {
    id: "s2",
    salonId: "lumiere",
    name: "قص وتصفيف",
    category: "hair",
    price: 180,
    durationMin: 60,
    deposit: 40,
  },
  {
    id: "s3",
    salonId: "lumiere",
    name: "بروتين علاجي",
    category: "hair",
    price: 900,
    durationMin: 240,
    deposit: 150,
  },
  {
    id: "s4",
    salonId: "lumiere",
    name: "مكياج سهرة",
    category: "makeup",
    price: 350,
    durationMin: 75,
    deposit: 70,
  },
  // nailbar
  {
    id: "s5",
    salonId: "nailbar",
    name: "مناكير جل",
    category: "nails",
    price: 120,
    durationMin: 60,
    deposit: 30,
    popular: true,
  },
  {
    id: "s6",
    salonId: "nailbar",
    name: "باديكير سبا",
    category: "nails",
    price: 140,
    durationMin: 60,
    deposit: 30,
  },
  {
    id: "s7",
    salonId: "nailbar",
    name: "أكريليك مع تصميم",
    category: "nails",
    price: 260,
    durationMin: 120,
    deposit: 60,
  },
  {
    id: "s8",
    salonId: "nailbar",
    name: "إزالة وتقوية",
    category: "nails",
    price: 90,
    durationMin: 40,
    deposit: 0,
  },
  // velvet
  {
    id: "s9",
    salonId: "velvet",
    name: "هيدرافيشل",
    category: "skin",
    price: 550,
    durationMin: 60,
    deposit: 100,
    popular: true,
  },
  {
    id: "s10",
    salonId: "velvet",
    name: "تنظيف عميق",
    category: "skin",
    price: 250,
    durationMin: 50,
    deposit: 50,
  },
  {
    id: "s11",
    salonId: "velvet",
    name: "جلسة استرخاء وجه",
    category: "spa",
    price: 300,
    durationMin: 45,
    deposit: 50,
  },
  // noor
  {
    id: "s12",
    salonId: "noor",
    name: "مكياج مناسبات",
    category: "makeup",
    price: 400,
    durationMin: 90,
    deposit: 80,
    popular: true,
  },
  {
    id: "s13",
    salonId: "noor",
    name: "تسريحة سهرة",
    category: "hair",
    price: 250,
    durationMin: 60,
    deposit: 50,
  },
  {
    id: "s14",
    salonId: "noor",
    name: "مكياج ناعم",
    category: "makeup",
    price: 150,
    durationMin: 45,
    deposit: 30,
  },
  // sakina
  {
    id: "s15",
    salonId: "sakina",
    name: "حمام مغربي ملكي",
    category: "spa",
    price: 380,
    durationMin: 90,
    deposit: 80,
    popular: true,
  },
  {
    id: "s16",
    salonId: "sakina",
    name: "مساج استرخائي",
    category: "spa",
    price: 320,
    durationMin: 60,
    deposit: 60,
  },
  {
    id: "s17",
    salonId: "sakina",
    name: "ماسك بشرة مغذّي",
    category: "skin",
    price: 220,
    durationMin: 40,
    deposit: 40,
  },
  // athome
  {
    id: "s18",
    salonId: "athome",
    name: "مكياج منزلي",
    category: "makeup",
    price: 450,
    durationMin: 90,
    deposit: 100,
    popular: true,
  },
  {
    id: "s19",
    salonId: "athome",
    name: "مناكير وباديكير منزلي",
    category: "nails",
    price: 260,
    durationMin: 90,
    deposit: 60,
  },
  {
    id: "s20",
    salonId: "athome",
    name: "استشوار منزلي",
    category: "hair",
    price: 200,
    durationMin: 60,
    deposit: 50,
  },
  // bride
  {
    id: "s21",
    salonId: "bride",
    name: "باقة العروس الكاملة",
    category: "bridal",
    price: 4500,
    durationMin: 300,
    deposit: 1350,
    popular: true,
  },
  {
    id: "s22",
    salonId: "bride",
    name: "بروفة مكياج",
    category: "makeup",
    price: 600,
    durationMin: 90,
    deposit: 180,
  },
  {
    id: "s23",
    salonId: "bride",
    name: "باقة الأم والأخوات",
    category: "bridal",
    price: 1800,
    durationMin: 180,
    deposit: 540,
  },
];

export const STAFF: Staff[] = [
  {
    id: "t1",
    salonId: "lumiere",
    name: "ريناد",
    title: "خبيرة ألوان",
    rating: 4.9,
    reviews: 140,
    specialties: ["hair"],
    initials: "ر",
  },
  {
    id: "t2",
    salonId: "lumiere",
    name: "لينا",
    title: "مصففة أولى",
    rating: 4.8,
    reviews: 96,
    specialties: ["hair", "makeup"],
    initials: "ل",
  },
  {
    id: "t3",
    salonId: "lumiere",
    name: "دانة",
    title: "خبيرة مكياج",
    rating: 4.7,
    reviews: 52,
    specialties: ["makeup"],
    initials: "د",
  },
  {
    id: "t4",
    salonId: "nailbar",
    name: "سارة",
    title: "فنانة أظافر",
    rating: 4.8,
    reviews: 110,
    specialties: ["nails"],
    initials: "س",
  },
  {
    id: "t5",
    salonId: "nailbar",
    name: "منى",
    title: "أخصائية جل",
    rating: 4.6,
    reviews: 63,
    specialties: ["nails"],
    initials: "م",
  },
  {
    id: "t6",
    salonId: "velvet",
    name: "د. هيا",
    title: "أخصائية بشرة",
    rating: 4.9,
    reviews: 88,
    specialties: ["skin"],
    initials: "هـ",
  },
  {
    id: "t7",
    salonId: "velvet",
    name: "أروى",
    title: "معالجة سبا",
    rating: 4.7,
    reviews: 41,
    specialties: ["spa", "skin"],
    initials: "أ",
  },
  {
    id: "t8",
    salonId: "noor",
    name: "نورة",
    title: "ميكب آرتست",
    rating: 4.7,
    reviews: 70,
    specialties: ["makeup", "bridal"],
    initials: "ن",
  },
  {
    id: "t9",
    salonId: "noor",
    name: "شهد",
    title: "مصففة",
    rating: 4.5,
    reviews: 24,
    specialties: ["hair"],
    initials: "ش",
  },
  {
    id: "t10",
    salonId: "sakina",
    name: "فاطمة",
    title: "معالجة أولى",
    rating: 4.9,
    reviews: 200,
    specialties: ["spa"],
    initials: "ف",
  },
  {
    id: "t11",
    salonId: "sakina",
    name: "جود",
    title: "معالجة",
    rating: 4.8,
    reviews: 130,
    specialties: ["spa", "skin"],
    initials: "ج",
  },
  {
    id: "t12",
    salonId: "athome",
    name: "ريم",
    title: "خبيرة متنقلة",
    rating: 4.8,
    reviews: 90,
    specialties: ["makeup", "hair"],
    initials: "ر",
  },
  {
    id: "t13",
    salonId: "athome",
    name: "غادة",
    title: "خبيرة أظافر متنقلة",
    rating: 4.6,
    reviews: 58,
    specialties: ["nails"],
    initials: "غ",
  },
  {
    id: "t14",
    salonId: "bride",
    name: "أ. عبير",
    title: "مصممة لوك العروس",
    rating: 4.9,
    reviews: 45,
    specialties: ["bridal", "makeup"],
    initials: "ع",
  },
  {
    id: "t15",
    salonId: "bride",
    name: "مها",
    title: "مصففة شعر عرايس",
    rating: 4.8,
    reviews: 30,
    specialties: ["hair", "bridal"],
    initials: "م",
  },
];

export const SALON_REVIEWS: SalonReview[] = [
  {
    id: "r1",
    salonId: "lumiere",
    author: "أ. م.",
    date: "قبل 3 أيام",
    overall: 5,
    text: "ريناد فهمت اللون اللي أبيه من أول صورة. النتيجة أحلى من المتوقع والخصوصية ممتازة.",
    scores: {
      service: 5,
      punctuality: 5,
      cleanliness: 5,
      result: 5,
      treatment: 5,
      photoMatch: 5,
      priceMatch: 4,
    },
  },
  {
    id: "r2",
    salonId: "lumiere",
    author: "ن. س.",
    date: "قبل أسبوع",
    overall: 4,
    text: "الشغل نظيف بس تأخروا 20 دقيقة عن الموعد.",
    scores: {
      service: 4,
      punctuality: 3,
      cleanliness: 5,
      result: 5,
      treatment: 4,
      photoMatch: 4,
      priceMatch: 4,
    },
  },
  {
    id: "r3",
    salonId: "nailbar",
    author: "ه. ع.",
    date: "أمس",
    overall: 5,
    text: "التصميم مطابق للصورة 100% والسعر واضح من البداية.",
    scores: {
      service: 5,
      punctuality: 5,
      cleanliness: 5,
      result: 5,
      treatment: 5,
      photoMatch: 5,
      priceMatch: 5,
    },
  },
  {
    id: "r4",
    salonId: "velvet",
    author: "ر. ق.",
    date: "قبل 5 أيام",
    overall: 5,
    text: "د. هيا شرحت كل خطوة، وبشرتي صارت أنعم من أول جلسة.",
    scores: {
      service: 5,
      punctuality: 5,
      cleanliness: 5,
      result: 5,
      treatment: 5,
      photoMatch: 4,
      priceMatch: 4,
    },
  },
  {
    id: "r5",
    salonId: "sakina",
    author: "ل. ح.",
    date: "قبل يومين",
    overall: 5,
    text: "أفضل حمام مغربي جربته في الرياض. هدوء ونظافة واحترام للوقت.",
    scores: {
      service: 5,
      punctuality: 5,
      cleanliness: 5,
      result: 5,
      treatment: 5,
      photoMatch: 5,
      priceMatch: 5,
    },
  },
  {
    id: "r6",
    salonId: "noor",
    author: "س. ب.",
    date: "قبل 4 أيام",
    overall: 4,
    text: "المكياج ثابت طول السهرة، بس أتمنى توفر غرفة خاصة.",
    scores: {
      service: 4,
      punctuality: 4,
      cleanliness: 4,
      result: 5,
      treatment: 5,
      photoMatch: 4,
      priceMatch: 4,
    },
  },
];

/** Time slots per day; a few are marked booked to demonstrate waitlist. */
export const TIME_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

export function slotStatus(salonId: string, dayOffset: number, time: string): "free" | "booked" {
  // Deterministic pseudo-random availability so the demo is stable.
  const h = [...`${salonId}-${dayOffset}-${time}`].reduce((a, c) => a + c.charCodeAt(0), 0);
  return h % 3 === 0 ? "booked" : "free";
}

export function formatSAR(n: number) {
  return `${n.toLocaleString("ar-SA-u-nu-latn")} ر.س`;
}

export function to12h(t: string) {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const suffix = h >= 12 ? "م" : "ص";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function upcomingDays(count = 7) {
  const base = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      offset: i,
      iso: d.toISOString().slice(0, 10),
      dayName: i === 0 ? "اليوم" : i === 1 ? "غدًا" : DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      month: d.toLocaleDateString("ar-SA-u-nu-latn", { month: "short" }),
    };
  });
}

/* ---------- Business (salon owner) demo data — salon "lumiere" ---------- */

export interface BizAppointment {
  id: string;
  time: string;
  staffId: string;
  serviceId: string;
  client: string;
  status: "confirmed" | "arrived" | "done" | "free";
}

export const BIZ_TODAY: BizAppointment[] = [
  { id: "b1", time: "10:00", staffId: "t1", serviceId: "s1", client: "هند ع.", status: "done" },
  { id: "b2", time: "11:00", staffId: "t2", serviceId: "s2", client: "غلا م.", status: "done" },
  { id: "b3", time: "13:00", staffId: "t1", serviceId: "s2", client: "ريم س.", status: "arrived" },
  {
    id: "b4",
    time: "14:00",
    staffId: "t3",
    serviceId: "s4",
    client: "أروى ن.",
    status: "confirmed",
  },
  {
    id: "b5",
    time: "16:00",
    staffId: "t2",
    serviceId: "s3",
    client: "بدور ق.",
    status: "confirmed",
  },
  {
    id: "b6",
    time: "18:00",
    staffId: "t1",
    serviceId: "s1",
    client: "شذى ع.",
    status: "confirmed",
  },
  {
    id: "b7",
    time: "20:00",
    staffId: "t3",
    serviceId: "s4",
    client: "لمى ح.",
    status: "confirmed",
  },
];

export const BIZ_INACTIVE_CLIENTS = [
  { name: "منيرة الفهد", lastVisit: "قبل 74 يوم", lastService: "بالاياج كامل", spend: 1950 },
  { name: "الجوهرة السعيد", lastVisit: "قبل 68 يوم", lastService: "قص وتصفيف", spend: 540 },
  { name: "وجدان الحربي", lastVisit: "قبل 91 يوم", lastService: "بروتين علاجي", spend: 900 },
  { name: "أفنان المطيري", lastVisit: "قبل 63 يوم", lastService: "مكياج سهرة", spend: 700 },
  { name: "لطيفة القحطاني", lastVisit: "قبل 120 يوم", lastService: "بالاياج كامل", spend: 1300 },
];

export const BIZ_WEEK_REVENUE = [
  { day: "سبت", revenue: 3200 },
  { day: "أحد", revenue: 2750 },
  { day: "اثنين", revenue: 1900 },
  { day: "ثلاثاء", revenue: 2400 },
  { day: "أربعاء", revenue: 3100 },
  { day: "خميس", revenue: 4600 },
  { day: "جمعة", revenue: 3900 },
];

/* ---------- Admin demo data ---------- */

export type ApprovalStatus = "approved" | "pending" | "rejected" | "docs_missing";

export interface AdminSalon {
  id: string;
  name: string;
  area: Area;
  status: ApprovalStatus;
  plan: "Starter" | "Professional" | "Enterprise";
  docs: { label: string; ok: boolean }[];
  joined: string;
  bookings30d: number;
  glamNewClients30d: number;
}

export const ADMIN_SALONS: AdminSalon[] = [
  {
    id: "lumiere",
    name: "لوميير ستوديو",
    area: "شمال الرياض",
    status: "approved",
    plan: "Professional",
    joined: "2026-03-14",
    bookings30d: 212,
    glamNewClients30d: 38,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "رخصة البلدية", ok: true },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "nailbar",
    name: "نيل بار الرياض",
    area: "شمال الرياض",
    status: "approved",
    plan: "Starter",
    joined: "2026-04-02",
    bookings30d: 164,
    glamNewClients30d: 21,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "رخصة البلدية", ok: true },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "velvet",
    name: "فيلفت سكن كلينك",
    area: "شرق الرياض",
    status: "approved",
    plan: "Professional",
    joined: "2026-05-20",
    bookings30d: 98,
    glamNewClients30d: 17,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "ترخيص هيئة الصحة", ok: true },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "noor",
    name: "نور بيوتي لاونج",
    area: "غرب الرياض",
    status: "docs_missing",
    plan: "Starter",
    joined: "2026-08-30",
    bookings30d: 41,
    glamNewClients30d: 9,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "رخصة البلدية", ok: false },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "sakina",
    name: "سكينة سبا",
    area: "وسط الرياض",
    status: "approved",
    plan: "Enterprise",
    joined: "2026-02-01",
    bookings30d: 355,
    glamNewClients30d: 52,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "رخصة البلدية", ok: true },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "petal",
    name: "بيتال هير لاب",
    area: "جنوب الرياض",
    status: "pending",
    plan: "Starter",
    joined: "2026-09-06",
    bookings30d: 0,
    glamNewClients30d: 0,
    docs: [
      { label: "السجل التجاري", ok: true },
      { label: "رخصة البلدية", ok: true },
      { label: "شهادة الصحة", ok: false },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
  {
    id: "aura",
    name: "أورا نيلز",
    area: "شرق الرياض",
    status: "rejected",
    plan: "Starter",
    joined: "2026-08-12",
    bookings30d: 0,
    glamNewClients30d: 0,
    docs: [
      { label: "السجل التجاري", ok: false },
      { label: "رخصة البلدية", ok: false },
      { label: "شهادة الصحة", ok: true },
      { label: "الهوية الوطنية للمالكة", ok: true },
    ],
  },
];

export interface AdminDispute {
  id: string;
  salon: string;
  client: string;
  issue: string;
  amount: number;
  status: "open" | "reviewing" | "resolved";
  opened: string;
}

export const ADMIN_DISPUTES: AdminDispute[] = [
  {
    id: "d1",
    salon: "نور بيوتي لاونج",
    client: "س. ب.",
    issue: "النتيجة لا تطابق الصورة المتفق عليها",
    amount: 400,
    status: "reviewing",
    opened: "قبل يومين",
  },
  {
    id: "d2",
    salon: "نيل بار الرياض",
    client: "م. ر.",
    issue: "إلغاء من الصالون قبل ساعة بدون إشعار",
    amount: 30,
    status: "open",
    opened: "أمس",
  },
  {
    id: "d3",
    salon: "لوميير ستوديو",
    client: "ع. ف.",
    issue: "خلاف على استرداد العربون",
    amount: 100,
    status: "resolved",
    opened: "قبل 6 أيام",
  },
];

export const ADMIN_KPIS = {
  gmv30d: 486_500,
  bookings30d: 1_284,
  activeSalons: 5,
  pendingSalons: 2,
  newClients30d: 137,
  commissionRevenue: 27_900,
  subscriptionRevenue: 4_990,
  disputesOpen: 2,
};

export const PLANS = [
  { name: "Starter", price: 199, note: "فرع واحد، جدول وحجوزات" },
  { name: "Professional", price: 399, note: "حملات ذكية، تقارير، Privacy Mode" },
  { name: "Enterprise", price: null, note: "حسب عدد الفروع" },
];

export const byId = {
  salon: (id: string) => SALONS.find((s) => s.id === id),
  service: (id: string) => SERVICES.find((s) => s.id === id),
  staff: (id: string) => STAFF.find((s) => s.id === id),
  category: (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!,
};
