import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Home,
  Calendar,
  UtensilsCrossed,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  Leaf,
  Dumbbell,
  TrendingUp,
  Heart,
  Zap,
  Soup,
  Coffee,
  MapPin,
  Wallet,
  Search,
  GraduationCap,
  Salad,
  SlidersHorizontal,
  Building2,
  Gift,
  Camera,
  Pizza,
  AlertTriangle,
} from "lucide-react";

/* ========================================================================
   DIETYAAR — data model, recommendation engine, UI.

   Architecture notes (for future Supabase migration):
   - Everything below the "PERSISTENCE" section is pure/UI and doesn't know
     where data comes from.
   - Persistence currently uses the artifact key-value storage (window.storage),
     NOT localStorage (localStorage/sessionStorage don't work inside Claude.ai
     artifacts). The storage shape mirrors the eventual Supabase tables:
     profiles, preferences, goals, meal_plans, meal_plan_items, meal_history.
   - uploadProfilePhoto() has the exact signature it will need once it calls
     Supabase Storage instead of local key/value storage.
========================================================================= */

/* ----------------------------------------------------------------------
   DATA
---------------------------------------------------------------------- */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // Monday = 0 ... Sunday = 6

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };
const MEAL_TIME_WINDOWS = {
  breakfast: "7:00 – 10:00",
  lunch: "12:30 – 15:00",
  snack: "16:00 – 18:00",
  dinner: "19:30 – 22:00",
};

const SOURCE_LABELS = {
  mess: "College Mess",
  canteen: "College Canteen",
  cafe: "Campus Café",
  home: "Home Food",
  hostel: "Hostel",
  outside: "Outside Food",
};
const SOURCE_CONTEXT = { mess: "mess", canteen: "canteen", cafe: "café", home: "home kitchen", hostel: "hostel", outside: "usual spot" };

const TAG_LABELS = {
  protein: "Protein-rich",
  quick: "Quick",
  budget: "Budget-friendly",
  junk: "Occasional treat",
  balanced: "Balanced",
  light: "Light",
};
const JUNK_BOOSTS = ["eggs", "vegetables", "curd", "fruit"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const GOALS = [
  { id: "eat-healthier", label: "Eat healthier", icon: Leaf },
  { id: "gain-muscle", label: "Gain muscle", icon: Dumbbell },
  { id: "lose-weight", label: "Lose weight", icon: TrendingUp },
  { id: "maintain-weight", label: "Maintain weight", icon: Heart },
  { id: "improve-energy", label: "Improve energy", icon: Zap },
  { id: "better-habits", label: "Build better eating habits", icon: Sparkles },
];

const DIETS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "non-vegetarian", label: "Non-vegetarian" },
  { id: "vegan", label: "Vegan" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary" },
  { id: "lightly-active", label: "Lightly active" },
  { id: "moderately-active", label: "Moderately active" },
  { id: "very-active", label: "Very active" },
];

const EXERCISE_FREQS = [
  { id: "never", label: "Never" },
  { id: "1-2", label: "1–2 days/week" },
  { id: "3-4", label: "3–4 days/week" },
  { id: "5-plus", label: "5+ days/week" },
];

const SOURCE_OPTIONS = [
  { id: "mess", label: "College Mess", icon: Soup },
  { id: "canteen", label: "Canteen", icon: UtensilsCrossed },
  { id: "cafe", label: "Café", icon: Coffee },
  { id: "home", label: "Home food", icon: Heart },
  { id: "hostel", label: "Hostel", icon: Building2 },
  { id: "outside", label: "Outside food", icon: MapPin },
];

const FEATURES = [
  { title: "Built for College", desc: "Designed around mess timings, class schedules and hostel life — not generic diet advice.", icon: GraduationCap },
  { title: "Your Food, Not Fantasy Food", desc: "Plans built from what your mess, canteen and café actually serve.", icon: Salad },
  { title: "Flexible, Not Restrictive", desc: "Swap meals anytime. Miss a meal, run late, or crave Maggi — DietYaar adapts.", icon: SlidersHorizontal },
  { title: "Always Free", desc: "No subscriptions, no ads, no premium tiers. Just a plan that works.", icon: Gift },
];

const HOW_STEPS = [
  { title: "Tell us about you", desc: "Share your goals, preferences and where you usually eat on campus." },
  { title: "We build your plan", desc: "Get a realistic plan built from food that's actually available to you." },
  { title: "Eat smarter, swap easily", desc: "Follow your plan, swap meals anytime, and adjust for busy days." },
];

/* Goal, diet and source strategies drive the recommendation engine AND
   surface as short explanatory copy in onboarding / profile / food. */

const GOAL_STRATEGIES = {
  "eat-healthier": { weights: { balanced: 8, light: 5, protein: 2, junk: -6 }, focus: "Whole foods, vegetables and balanced plates." },
  "gain-muscle": { weights: { protein: 10, balanced: 3, junk: -4 }, focus: "Higher protein at every meal." },
  "lose-weight": { weights: { light: 8, balanced: 6, junk: -8, protein: 2 }, focus: "Filling, lighter meals — no extreme restriction." },
  "maintain-weight": { weights: { balanced: 7, protein: 3, junk: -3 }, focus: "Steady, varied and balanced." },
  "improve-energy": { weights: { balanced: 5, light: 4, protein: 4, junk: -5 }, focus: "Consistent meals so you avoid energy crashes." },
  "better-habits": { weights: { balanced: 5, quick: 3, junk: -3 }, focus: "Simple, regular meals you'll actually stick to." },
};

const DIET_STRATEGIES = {
  vegetarian: { label: "Vegetarian", detail: "We'll never suggest meat, fish or eggs." },
  eggetarian: { label: "Eggetarian", detail: "Vegetarian food plus eggs — no meat or fish." },
  "non-vegetarian": { label: "Non-vegetarian", detail: "Vegetarian, egg and meat options, all in the mix." },
  vegan: { label: "Vegan", detail: "We'll exclude dairy, curd, paneer and eggs too." },
};

const SOURCE_STRATEGIES = {
  mess: { detail: "Fixed timings, limited choice, a menu that rotates daily — we work with what's actually being served." },
  canteen: { detail: "Convenience-first — quick plates and sandwiches between classes, with the occasional treat." },
  cafe: { detail: "A more relaxed menu — coffee, smoothies and wraps for when you have a bit more time." },
  home: { detail: "Fresh, homemade and flexible — usually the widest variety of anywhere you eat." },
  hostel: { detail: "Basic appliances only — instant and no-cook options that are actually realistic." },
  outside: { detail: "Restaurant and takeaway picks for when you're eating out." },
};

function getGoalStrategy(goalId) {
  return GOAL_STRATEGIES[goalId] || null;
}
function getDietStrategy(dietId) {
  return DIET_STRATEGIES[dietId] || null;
}
function getSourceStrategy(sourceId) {
  return SOURCE_STRATEGIES[sourceId] || null;
}

/* Meal combos. Each is a realistic, ready-to-eat combination rather than a
   single ingredient — this keeps recommendations concrete ("Dal + Roti +
   Sabzi + Curd") instead of abstract nutrition targets. availableDays models
   a rotating mess menu / weekend specials; the scoring engine gracefully
   falls back to "any day" if nothing matches for a given diet + source. */

const MEAL_COMBOS = [
  // ---- MESS ----
  { id: "m1", items: ["Poha"], source: "mess", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget"], availableDays: [0, 3], calories: 250, protein: 6 },
  { id: "m2", items: ["Upma"], source: "mess", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget"], availableDays: [1, 4], calories: 230, protein: 5 },
  { id: "m3", items: ["Idli", "Sambhar"], source: "mess", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["light", "budget"], availableDays: [2, 5], calories: 220, protein: 7 },
  { id: "m4", items: ["Dosa", "Chutney"], source: "mess", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["budget"], availableDays: [6], calories: 260, protein: 6 },
  { id: "m5", items: ["Eggs", "Toast"], source: "mess", mealTypes: ["breakfast"], vegetarian: false, egg: true, dairy: false, tags: ["protein", "quick"], availableDays: [0, 2, 4], calories: 300, protein: 16 },
  { id: "m6", items: ["Dal", "Rice", "Roti", "Sabzi"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["balanced"], availableDays: [0, 2, 4, 6], calories: 520, protein: 18 },
  { id: "m7", items: ["Dal", "Roti", "Sabzi", "Curd"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["balanced"], availableDays: [1, 3, 5], calories: 480, protein: 17 },
  { id: "m8", items: ["Rajma", "Rice", "Curd"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein", "balanced"], availableDays: [0, 3], calories: 540, protein: 20 },
  { id: "m9", items: ["Chole", "Rice", "Curd"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein", "balanced"], availableDays: [1, 4], calories: 560, protein: 19 },
  { id: "m10", items: ["Paneer", "Roti", "Sabzi"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: [2, 5, 6], calories: 500, protein: 22 },
  { id: "m11", items: ["Khichdi", "Curd"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["light", "budget"], availableDays: [6], calories: 380, protein: 12 },
  { id: "m12", items: ["Chicken", "Rice", "Sabzi"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: false, egg: false, dairy: false, tags: ["protein"], availableDays: [2, 6], calories: 560, protein: 30 },
  { id: "m13", items: ["Curd", "Fruit"], source: "mess", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: true, tags: ["light", "budget"], availableDays: ALL_DAYS, calories: 150, protein: 5 },
  { id: "m14", items: ["Paneer", "Roti"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: [1, 4], calories: 420, protein: 18 },
  { id: "m15", items: ["Egg Bhurji", "Roti"], source: "mess", mealTypes: ["breakfast", "lunch", "dinner"], vegetarian: false, egg: true, dairy: false, tags: ["protein"], availableDays: [0, 3, 5], calories: 380, protein: 17 },
  { id: "m16", items: ["Vegetable Rice", "Curd"], source: "mess", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["light"], availableDays: [0, 2, 4], calories: 360, protein: 9 },
  { id: "m17", items: ["Fruit"], source: "mess", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: false, tags: ["light", "budget"], availableDays: ALL_DAYS, calories: 80, protein: 1 },

  // ---- CANTEEN ----
  { id: "c1", items: ["Maggi"], source: "canteen", mealTypes: ["snack", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS, calories: 340, protein: 7 },
  { id: "c2", items: ["Veg Sandwich"], source: "canteen", mealTypes: ["breakfast", "snack"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget"], availableDays: ALL_DAYS, calories: 260, protein: 6 },
  { id: "c3", items: ["Paneer Sandwich"], source: "canteen", mealTypes: ["lunch", "snack"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS, calories: 320, protein: 12 },
  { id: "c4", items: ["Frankie"], source: "canteen", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["quick"], availableDays: ALL_DAYS, calories: 380, protein: 9 },
  { id: "c5", items: ["Samosa", "Tea"], source: "canteen", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: true, tags: ["budget", "junk"], availableDays: ALL_DAYS, calories: 280, protein: 4 },
  { id: "c6", items: ["Vada Pav"], source: "canteen", mealTypes: ["snack", "breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS, calories: 300, protein: 5 },
  { id: "c7", items: ["Fried Rice"], source: "canteen", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["budget"], availableDays: ALL_DAYS, calories: 420, protein: 8 },
  { id: "c8", items: ["Noodles"], source: "canteen", mealTypes: ["lunch", "dinner", "snack"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS, calories: 400, protein: 8 },
  { id: "c9", items: ["Cold Coffee"], source: "canteen", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS, calories: 180, protein: 4 },

  // ---- CAFÉ ----
  { id: "cf1", items: ["Egg Sandwich", "Coffee"], source: "cafe", mealTypes: ["breakfast"], vegetarian: false, egg: true, dairy: true, tags: ["protein", "quick"], availableDays: ALL_DAYS, calories: 340, protein: 15 },
  { id: "cf2", items: ["Smoothie", "Fruit Bowl"], source: "cafe", mealTypes: ["breakfast", "snack"], vegetarian: true, egg: false, dairy: true, tags: ["light"], availableDays: ALL_DAYS, calories: 260, protein: 8 },
  { id: "cf3", items: ["Paneer Sandwich", "Smoothie"], source: "cafe", mealTypes: ["lunch", "snack"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS, calories: 380, protein: 14 },
  { id: "cf4", items: ["Wrap", "Fruit Bowl"], source: "cafe", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["balanced"], availableDays: ALL_DAYS, calories: 400, protein: 12 },
  { id: "cf5", items: ["Pasta"], source: "cafe", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["junk"], availableDays: [4, 5, 6], calories: 450, protein: 10 },
  { id: "cf6", items: ["Fruit Bowl"], source: "cafe", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: false, tags: ["light", "budget"], availableDays: ALL_DAYS, calories: 120, protein: 2 },
  { id: "cf7", items: ["Toast", "Fruit Bowl"], source: "cafe", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["light", "quick"], availableDays: ALL_DAYS, calories: 200, protein: 5 },

  // ---- HOME ----
  { id: "h1", items: ["Paratha", "Curd", "Fruit"], source: "home", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: true, tags: ["balanced"], availableDays: ALL_DAYS, calories: 420, protein: 12 },
  { id: "h2", items: ["Home Dal", "Rice", "Sabzi", "Roti"], source: "home", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["balanced"], availableDays: ALL_DAYS, calories: 520, protein: 18 },
  { id: "h3", items: ["Fruit", "Milk"], source: "home", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: true, tags: ["light"], availableDays: ALL_DAYS, calories: 180, protein: 7 },
  { id: "h4", items: ["Home Chicken", "Roti", "Salad"], source: "home", mealTypes: ["dinner"], vegetarian: false, egg: false, dairy: false, tags: ["protein"], availableDays: [5, 6], calories: 540, protein: 34 },
  { id: "h5", items: ["Paneer", "Roti", "Sabzi"], source: "home", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS, calories: 500, protein: 22 },
  { id: "h6", items: ["Homemade Poha"], source: "home", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "balanced"], availableDays: ALL_DAYS, calories: 260, protein: 6 },
  { id: "h7", items: ["Egg Curry", "Rice"], source: "home", mealTypes: ["lunch", "dinner"], vegetarian: false, egg: true, dairy: false, tags: ["protein"], availableDays: ALL_DAYS, calories: 480, protein: 20 },
  { id: "h8", items: ["Homemade Sandwich", "Fruit"], source: "home", mealTypes: ["snack", "breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick"], availableDays: ALL_DAYS, calories: 260, protein: 7 },
  { id: "h9", items: ["Khichdi", "Ghee", "Curd"], source: "home", mealTypes: ["dinner"], vegetarian: true, egg: false, dairy: true, tags: ["light", "balanced"], availableDays: ALL_DAYS, calories: 400, protein: 12 },
  { id: "h10", items: ["Rajma Chawal", "Salad"], source: "home", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["balanced", "protein"], availableDays: ALL_DAYS, calories: 500, protein: 19 },

  // ---- HOSTEL ----
  { id: "ho1", items: ["Maggi"], source: "hostel", mealTypes: ["breakfast", "snack", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS, calories: 340, protein: 7 },
  { id: "ho2", items: ["Bread", "Peanut Butter"], source: "hostel", mealTypes: ["breakfast", "snack"], vegetarian: true, egg: false, dairy: false, tags: ["quick"], availableDays: ALL_DAYS, calories: 300, protein: 9 },
  { id: "ho3", items: ["Boiled Eggs"], source: "hostel", mealTypes: ["breakfast", "snack"], vegetarian: false, egg: true, dairy: false, tags: ["protein", "quick"], availableDays: ALL_DAYS, calories: 180, protein: 13 },
  { id: "ho4", items: ["Instant Oats", "Fruit"], source: "hostel", mealTypes: ["breakfast"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "light"], availableDays: ALL_DAYS, calories: 240, protein: 7 },
  { id: "ho5", items: ["Cup Noodles"], source: "hostel", mealTypes: ["snack", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "junk", "budget"], availableDays: ALL_DAYS, calories: 320, protein: 6 },
  { id: "ho6", items: ["Curd Rice"], source: "hostel", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["light"], availableDays: ALL_DAYS, calories: 340, protein: 9 },
  { id: "ho7", items: ["Instant Rice", "Packet Dal"], source: "hostel", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget"], availableDays: ALL_DAYS, calories: 380, protein: 11 },

  // ---- OUTSIDE ----
  { id: "o1", items: ["Butter Chicken", "Naan"], source: "outside", mealTypes: ["lunch", "dinner"], vegetarian: false, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS, calories: 620, protein: 28 },
  { id: "o2", items: ["Paneer Tikka", "Roti"], source: "outside", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS, calories: 520, protein: 22 },
  { id: "o3", items: ["Veg Biryani", "Raita"], source: "outside", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: true, tags: ["balanced"], availableDays: ALL_DAYS, calories: 540, protein: 12 },
  { id: "o4", items: ["Chicken Biryani", "Raita"], source: "outside", mealTypes: ["lunch", "dinner"], vegetarian: false, egg: false, dairy: true, tags: ["protein"], availableDays: [4, 5, 6], calories: 620, protein: 26 },
  { id: "o5", items: ["Pizza"], source: "outside", mealTypes: ["dinner", "snack"], vegetarian: true, egg: false, dairy: true, tags: ["junk"], availableDays: [4, 5, 6], calories: 560, protein: 16 },
  { id: "o6", items: ["Burger", "Fries"], source: "outside", mealTypes: ["lunch", "dinner", "snack"], vegetarian: false, egg: false, dairy: true, tags: ["junk", "quick"], availableDays: ALL_DAYS, calories: 600, protein: 18 },
  { id: "o7", items: ["Salad Bowl"], source: "outside", mealTypes: ["lunch", "dinner"], vegetarian: true, egg: false, dairy: false, tags: ["light"], availableDays: ALL_DAYS, calories: 280, protein: 10 },
  { id: "o8", items: ["Momos"], source: "outside", mealTypes: ["snack"], vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget"], availableDays: ALL_DAYS, calories: 260, protein: 7 },

  // ---- ANNA CANTEEN (real location — confirmed menu + prices only) ----
  // Nutrition is intentionally omitted (left undefined) since it isn't confirmed.
  // dairy: null means "not confirmed" (ghee/curd/butter unknown) — this is treated as
  // NOT vegan-safe by isMealAllowedForDiet, without falsely asserting it contains dairy.
  { id: "anna-p-thali", items: ["P. Thali"], source: "canteen", locationId: "anna-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 120, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-chole-thali", items: ["Chole Thali"], source: "canteen", locationId: "anna-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-sb-thali", items: ["S.B. Thali"], source: "canteen", locationId: "anna-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 75, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-rice-plate", items: ["Rice Plate"], source: "canteen", locationId: "anna-canteen", category: "rice", mealTypes: ["lunch", "dinner"], price: 70, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-paratha-bhaji", items: ["Paratha Bhaji"], source: "canteen", locationId: "anna-canteen", category: "north-indian", mealTypes: ["breakfast", "snack"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-wada-sambar", items: ["Wada Sambar"], source: "canteen", locationId: "anna-canteen", category: "south-indian", mealTypes: ["breakfast", "snack"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-misal-pav", items: ["Misal Pav"], source: "canteen", locationId: "anna-canteen", category: "maharashtrian", mealTypes: ["breakfast", "snack"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "anna-pav-bhaji", items: ["Pav Bhaji"], source: "canteen", locationId: "anna-canteen", category: "maharashtrian", mealTypes: ["snack", "dinner"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-aloo-paratha", items: ["Aloo Paratha"], source: "canteen", locationId: "anna-canteen", category: "north-indian", mealTypes: ["breakfast", "snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-masala-dosa", items: ["Masala Dosa"], source: "canteen", locationId: "anna-canteen", category: "south-indian", mealTypes: ["breakfast", "snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-uttapa", items: ["Uttapa"], source: "canteen", locationId: "anna-canteen", category: "south-indian", mealTypes: ["breakfast", "snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-chapati-bhaji", items: ["Chapati Bhaji"], source: "canteen", locationId: "anna-canteen", category: "north-indian", mealTypes: ["lunch", "dinner"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-sabudana-khichdi", items: ["Sabudana Khichdi"], source: "canteen", locationId: "anna-canteen", category: "maharashtrian", mealTypes: ["breakfast", "snack"], price: 40, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "anna-idli-sambar", items: ["Idli Sambar"], source: "canteen", locationId: "anna-canteen", category: "south-indian", mealTypes: ["breakfast", "snack"], price: 35, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },

  // ---- BREW BEANS CAFÉ (real location — confirmed menu + prices only) ----
  // Two "Chocolate Kuka" entries at different prices are both confirmed on the
  // menu as given (likely a size variant) — kept as separate real items rather
  // than guessing a label for the difference.
  { id: "bb-kuka", items: ["Kuka"], source: "cafe", locationId: "brew-beans", category: "beverage", mealTypes: ["snack"], price: 35, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "bb-kuka-crush", items: ["Kuka with Crush"], source: "cafe", locationId: "brew-beans", category: "beverage", mealTypes: ["snack"], price: 45, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "bb-choc-kuka-40", items: ["Chocolate Kuka"], source: "cafe", locationId: "brew-beans", category: "beverage", mealTypes: ["snack"], price: 40, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "bb-choc-kuka-50", items: ["Chocolate Kuka"], source: "cafe", locationId: "brew-beans", category: "beverage", mealTypes: ["snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "bb-plain-maggi", items: ["Plain Maggi"], source: "cafe", locationId: "brew-beans", category: "noodles", mealTypes: ["breakfast", "snack", "dinner"], price: 35, vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS },
  { id: "bb-tadka-maggi", items: ["Tadka Maggi"], source: "cafe", locationId: "brew-beans", category: "noodles", mealTypes: ["breakfast", "snack", "dinner"], price: 45, vegetarian: true, egg: false, dairy: false, tags: ["quick", "budget", "junk"], availableDays: ALL_DAYS },
  { id: "bb-corn-maggi", items: ["Corn Maggi"], source: "cafe", locationId: "brew-beans", category: "noodles", mealTypes: ["breakfast", "snack", "dinner"], price: 60, vegetarian: true, egg: false, dairy: false, tags: ["quick", "junk"], availableDays: ALL_DAYS },
  { id: "bb-veg-burger", items: ["Veg Burger"], source: "cafe", locationId: "brew-beans", category: "fast-food", mealTypes: ["lunch", "snack", "dinner"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick", "junk"], availableDays: ALL_DAYS },
  { id: "bb-paneer-burger", items: ["Paneer Burger"], source: "cafe", locationId: "brew-beans", category: "fast-food", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS },
  { id: "bb-salted-fries", items: ["Salted Fries"], source: "cafe", locationId: "brew-beans", category: "fast-food", mealTypes: ["snack"], price: 65, vegetarian: true, egg: false, dairy: false, tags: ["quick", "junk"], availableDays: ALL_DAYS },
  { id: "bb-peri-fries", items: ["Peri Peri Fries"], source: "cafe", locationId: "brew-beans", category: "fast-food", mealTypes: ["snack"], price: 80, vegetarian: true, egg: false, dairy: false, tags: ["quick", "junk"], availableDays: ALL_DAYS },
  { id: "bb-margherita", items: ["Margherita Pizza"], source: "cafe", locationId: "brew-beans", category: "pizza", mealTypes: ["lunch", "snack", "dinner"], price: 100, vegetarian: true, egg: false, dairy: true, tags: ["junk"], availableDays: ALL_DAYS },
  { id: "bb-veg-cheese-pizza", items: ["Veg Cheese Pizza"], source: "cafe", locationId: "brew-beans", category: "pizza", mealTypes: ["lunch", "snack", "dinner"], price: 110, vegetarian: true, egg: false, dairy: true, tags: ["junk"], availableDays: ALL_DAYS },
  { id: "bb-veg-corn-pizza", items: ["Veg Corn Pizza"], source: "cafe", locationId: "brew-beans", category: "pizza", mealTypes: ["lunch", "snack", "dinner"], price: 130, vegetarian: true, egg: false, dairy: null, tags: ["junk"], availableDays: ALL_DAYS },
  { id: "bb-classic-sandwich", items: ["Classic Sandwich"], source: "cafe", locationId: "brew-beans", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 65, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "bb-veg-sandwich", items: ["Veg Sandwich"], source: "cafe", locationId: "brew-beans", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 80, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "bb-paneer-sandwich", items: ["Paneer Sandwich"], source: "cafe", locationId: "brew-beans", category: "sandwich", mealTypes: ["lunch", "snack", "dinner"], price: 120, vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS },

  // ---- MATRI KATTA (real location — confirmed menu + prices only) ----
  { id: "mk-thick-coffee", items: ["Thick Coffee"], source: "cafe", locationId: "matri-katta", category: "beverage", mealTypes: ["snack"], price: 35, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-coffee-crush", items: ["Coffee with Crush"], source: "cafe", locationId: "matri-katta", category: "beverage", mealTypes: ["snack"], price: 40, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-flavour-coffee", items: ["Flavour Coffee"], source: "cafe", locationId: "matri-katta", category: "beverage", mealTypes: ["snack"], price: 45, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS, note: "Choice of Butterscotch, Vanilla or Hazelnut" },
  { id: "mk-choc-shake", items: ["Chocolate Shake"], source: "cafe", locationId: "matri-katta", category: "shake", mealTypes: ["snack"], price: 40, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-strawberry-shake", items: ["Strawberry Shake"], source: "cafe", locationId: "matri-katta", category: "shake", mealTypes: ["snack"], price: 40, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-rose-shake", items: ["Rose Shake"], source: "cafe", locationId: "matri-katta", category: "shake", mealTypes: ["snack"], price: 40, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-oreo-shake", items: ["Oreo Shake"], source: "cafe", locationId: "matri-katta", category: "shake", mealTypes: ["snack"], price: 50, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "mk-veg-grilled", items: ["Veg Grilled"], source: "cafe", locationId: "matri-katta", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 70, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "mk-cheese-grilled", items: ["Cheese Grilled"], source: "cafe", locationId: "matri-katta", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 80, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "mk-corn-grilled", items: ["Corn Grilled"], source: "cafe", locationId: "matri-katta", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 70, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "mk-cheese-corn-grilled", items: ["Cheese Corn Grilled"], source: "cafe", locationId: "matri-katta", category: "sandwich", mealTypes: ["breakfast", "lunch", "snack"], price: 80, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "mk-paneer-sandwich", items: ["Paneer Sandwich"], source: "cafe", locationId: "matri-katta", category: "sandwich", mealTypes: ["lunch", "snack", "dinner"], price: 90, vegetarian: true, egg: false, dairy: true, tags: ["protein"], availableDays: ALL_DAYS },

  // ---- POOLSIDE CANTEEN (real location — confirmed menu + prices only) ----
  // No nutrition, ingredients, hours or availability are recorded. Dietary flags are
  // set only where the dish name itself confirms them; null = unconfirmed (never
  // treated as vegan, vegetarian or egg-free). Tags are limited to quick/budget
  // (budget = lowest confirmed price <= 50) — no health claims.
  { id: "pool-misal-pav", items: ["Misal Pav"], source: "canteen", locationId: "poolside-canteen", category: "maharashtrian", mealTypes: ["breakfast", "snack"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-chole-bhature", items: ["Chole Bhature"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["breakfast", "lunch"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-paneer-paratha", items: ["Paneer Paratha"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["breakfast", "snack"], price: 70, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-aloo-paratha", items: ["Aloo Paratha"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["breakfast", "snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "pool-dal-khichadi", items: ["Dal Khichadi"], source: "canteen", locationId: "poolside-canteen", category: "khichadi", mealTypes: ["lunch", "dinner"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-macturian-khichadi", items: ["Macturian Khichadi"], source: "canteen", locationId: "poolside-canteen", category: "khichadi", mealTypes: ["lunch", "dinner"], price: 50, vegetarian: null, egg: null, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "pool-paneer-pulav", items: ["Paneer Pulav"], source: "canteen", locationId: "poolside-canteen", category: "rice", mealTypes: ["lunch", "dinner"], price: 40, vegetarian: true, egg: false, dairy: true, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "pool-veg-pulav", items: ["Veg Pulav"], source: "canteen", locationId: "poolside-canteen", category: "rice", mealTypes: ["lunch", "dinner"], price: 80, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-masala-rice", items: ["Masala Rice"], source: "canteen", locationId: "poolside-canteen", category: "rice", mealTypes: ["lunch", "dinner"], price: 80, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-veg-biryani", items: ["Veg Biryani"], source: "canteen", locationId: "poolside-canteen", category: "biryani", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-paneer-biryani", items: ["Paneer Biryani"], source: "canteen", locationId: "poolside-canteen", category: "biryani", mealTypes: ["lunch", "dinner"], price: 120, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-paneer-bhurji", items: ["Paneer Bhurji"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["lunch", "dinner"], price: 70, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-jeera-rice", items: ["Jeera Rice"], source: "canteen", locationId: "poolside-canteen", category: "rice", mealTypes: ["lunch", "dinner"], price: 40, priceOptions: [40, 60], vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "pool-dal-tadka", items: ["Dal Tadka"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["lunch", "dinner"], price: 80, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-punjabi-thali", items: ["Punjabi Thali"], source: "canteen", locationId: "poolside-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: null, egg: null, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-paneer-thali", items: ["Paneer Thali"], source: "canteen", locationId: "poolside-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: true, egg: false, dairy: true, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-chole-thali", items: ["Chole Thali"], source: "canteen", locationId: "poolside-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 100, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-chicken-thali", items: ["Chicken Thali"], source: "canteen", locationId: "poolside-canteen", category: "thali", mealTypes: ["lunch", "dinner"], price: 140, vegetarian: false, egg: null, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-batata-wada", items: ["Batata Wada"], source: "canteen", locationId: "poolside-canteen", category: "maharashtrian", mealTypes: ["breakfast", "snack"], price: 50, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
  { id: "pool-puri-bhaji", items: ["Puri Bhaji"], source: "canteen", locationId: "poolside-canteen", category: "north-indian", mealTypes: ["breakfast", "snack"], price: 60, vegetarian: true, egg: false, dairy: null, tags: ["quick"], availableDays: ALL_DAYS },
  { id: "pool-vada-pav", items: ["Vada Pav"], source: "canteen", locationId: "poolside-canteen", category: "maharashtrian", mealTypes: ["breakfast", "snack"], price: 20, vegetarian: true, egg: false, dairy: null, tags: ["quick", "budget"], availableDays: ALL_DAYS },
];

/* ------------------------------------------------------------------------
   FOOD LOCATIONS — real, named places within a food source (Section 21).
   Intended future hierarchy (data-driven — only these three are populated today):

   College
    ├── Mess        (e.g. Main Mess, Hostel Mess)
    ├── Canteens     (Anna Canteen, ...)
    ├── Cafés        (Brew Beans Café, Matri Katta, ...)
    └── Other Food   (Juice Centre, ...)

   `type` maps onto the existing source taxonomy (mess/canteen/cafe/home/hostel/outside)
   so the recommendation engine and Food Explorer don't need per-location code —
   they just filter MEAL_COMBOS by `locationId` / FOOD_LOCATIONS by `type`.
   `parcelCharge` (₹) is a confirmed, separate takeaway surcharge — never folded
   into the item's displayed price, only disclosed alongside it.
------------------------------------------------------------------------- */
const FOOD_LOCATIONS = [
  {
    id: "anna-canteen",
    name: "Anna Canteen",
    type: "canteen",
    description: "College canteen",
    active: true,
    // Left unknown on purpose — no confirmed hours yet. See getLocationAvailabilityLabel().
    openingTime: null,
    closingTime: null,
    weeklySchedule: null,
    parcelCharge: null,
  },
  {
    id: "brew-beans",
    name: "Brew Beans Café",
    type: "cafe",
    description: "Campus café",
    active: true,
    openingTime: null,
    closingTime: null,
    weeklySchedule: null,
    parcelCharge: 5,
  },
  {
    id: "matri-katta",
    name: "Matri Katta",
    type: "cafe",
    description: "Campus café",
    active: true,
    openingTime: null,
    closingTime: null,
    weeklySchedule: null,
    parcelCharge: 5,
  },
  {
    id: "poolside-canteen",
    name: "Poolside Canteen",
    type: "canteen",
    description: "Campus canteen",
    active: true,
    // Hours, schedule and parcel charge are unconfirmed — left null on purpose.
    openingTime: null,
    closingTime: null,
    weeklySchedule: null,
    parcelCharge: null,
  },
];

const EMPTY_PROFILE = {
  name: "",
  age: "",
  height: "",
  weight: "",
  goal: "",
  diet: "",
  restrictions: [],
  activity: "",
  exercise: "",
  sleepTime: "",
  wakeTime: "",
  collegeStart: "",
  collegeEnd: "",
  likes: [],
  dislikes: [],
  avoid: [],
  allergies: [],
  sources: [],
  budgetLimit: null, // ₹ per meal, null = no limit — Budget Mode
  preferredLocations: [], // optional FOOD_LOCATIONS ids — a soft nudge, never required
};

const DEMO_PROFILE = {
  name: "Aditi",
  age: "20",
  height: "160",
  weight: "55",
  goal: "gain-muscle",
  diet: "non-vegetarian",
  restrictions: [],
  activity: "very-active",
  exercise: "5-plus",
  sleepTime: "23:00",
  wakeTime: "07:30",
  collegeStart: "09:00",
  collegeEnd: "16:00",
  likes: ["paneer", "egg"],
  dislikes: ["noodles"],
  avoid: [],
  allergies: [],
  sources: ["mess", "canteen", "home"],
  budgetLimit: 100,
  preferredLocations: ["anna-canteen"],
};

/* ----------------------------------------------------------------------
   VALIDATION  (Section 6 — realistic age / height / weight)
---------------------------------------------------------------------- */

const FIELD_BOUNDS = {
  age: { min: 13, max: 100 },
  height: { min: 100, max: 250 },
  weight: { min: 25, max: 300 },
};

function validateNumericInput(value, min, max) {
  if (value === "" || value === null || value === undefined) {
    return { valid: false, message: "This field is required." };
  }
  const num = Number(value);
  if (Number.isNaN(num)) return { valid: false, message: "Please enter a number." };
  if (num < min || num > max) return { valid: false, message: `Please enter a value between ${min} and ${max}.` };
  return { valid: true, message: "" };
}

function getFieldError(field, value) {
  if (value === "" || value === null || value === undefined) return null;
  const bounds = FIELD_BOUNDS[field];
  const check = validateNumericInput(value, bounds.min, bounds.max);
  if (check.valid) return null;
  if (field === "age") return "Please enter an age between 13 and 100.";
  if (field === "height") return "Please enter a realistic height between 100 and 250 cm.";
  if (field === "weight") return "Please enter a realistic weight between 25 and 300 kg.";
  return check.message;
}

function isBasicInfoValid(draft) {
  if (!draft.name || !draft.name.trim()) return false;
  if (draft.age === "" || getFieldError("age", draft.age)) return false;
  if (draft.height === "" || getFieldError("height", draft.height)) return false;
  if (draft.weight === "" || getFieldError("weight", draft.weight)) return false;
  return true;
}

function validateProfile(profile) {
  const errors = {};
  if (!profile.name || !profile.name.trim()) errors.name = "Name is required.";
  if (profile.age === "") errors.age = "Age is required.";
  else if (getFieldError("age", profile.age)) errors.age = getFieldError("age", profile.age);
  if (profile.height === "") errors.height = "Height is required.";
  else if (getFieldError("height", profile.height)) errors.height = getFieldError("height", profile.height);
  if (profile.weight === "") errors.weight = "Weight is required.";
  else if (getFieldError("weight", profile.weight)) errors.weight = getFieldError("weight", profile.weight);
  if (!profile.goal) errors.goal = "Please choose a goal.";
  if (!profile.diet) errors.diet = "Please choose a dietary preference.";
  if (!profile.activity) errors.activity = "Please choose an activity level.";
  if (!profile.exercise) errors.exercise = "Please choose an exercise frequency.";
  if (!profile.sources || profile.sources.length === 0) errors.sources = "Select at least one food source.";
  return { valid: Object.keys(errors).length === 0, errors };
}

function validateStep(step, draft) {
  switch (step) {
    case 0:
      return isBasicInfoValid(draft);
    case 1:
      return !!draft.goal;
    case 2:
      return !!draft.diet;
    case 3:
      return !!draft.activity && !!draft.exercise;
    case 4:
      return true;
    case 5:
      return draft.sources.length > 0;
    default:
      return true;
  }
}

/* ----------------------------------------------------------------------
   BMI + WEEKLY PROGRESS
   Purely informational — never fed into the recommendation engine and
   never used to restrict or judge food choices. "Better choices, not
   perfect choices" applies here too.
---------------------------------------------------------------------- */

function calculateBMI(weight, height) {
  const w = Number(weight);
  const h = Number(height);
  if (!w || !h || w <= 0 || h <= 0) return null;
  const heightM = h / 100;
  return w / (heightM * heightM);
}

// Standard adult (18+) BMI bands. Never applied to under-18 profiles — for
// them we still show the number, just without a category label.
function getBMICategory(bmi, age) {
  if (bmi === null || bmi === undefined) return null;
  const ageNum = Number(age);
  if (!ageNum || ageNum < 18) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function daysSince(dateString) {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

/* ----------------------------------------------------------------------
   RECOMMENDATION ENGINE
   getRecommendedMeals() is the single entry point everything else calls,
   so scoring logic never gets duplicated across features.
---------------------------------------------------------------------- */

/* ----------------------------------------------------------------------
   SHARED DIETARY CLASSIFICATION & ELIGIBILITY
   One place decides what a food is and who may be offered it. Food Explorer,
   instant recommendations, daily/weekly plans, swaps, craving and missed-meal
   suggestions all go through getEligibility(), so they cannot disagree.

   Item schema (all dietary fields are optional / three-state):
     vegetarian: true | false | null   (null = unconfirmed)
     egg:        true | false | null
     dairy:      true | false | null
     ingredients?: string[]            confirmed FULL ingredient list (none recorded yet)
     allergens?:   string[]            confirmed allergen statement  (none recorded yet)
   Convention: vegetarian:false + egg:true = an egg dish (no meat recorded).
   Missing data stays missing — it is never treated as proof of compatibility.
---------------------------------------------------------------------- */

const DIET_CLASS_LABELS = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  eggetarian: "Contains egg",
  "non-vegetarian": "Non-vegetarian",
  unknown: "Unconfirmed",
};

function getDietClass(combo) {
  if (combo.egg === true) return "eggetarian";
  if (combo.vegetarian === false) return "non-vegetarian";
  if (combo.vegetarian === true) return combo.dairy === false && combo.egg === false ? "vegan" : "vegetarian";
  return "unknown";
}

// Is this food compatible with a diet? An unclassified ("unknown") item is never
// assumed compatible with ANY diet, including non-vegetarian.
function isMealAllowedForDiet(combo, diet) {
  const cls = getDietClass(combo);
  // A known omnivore profile may include any *classified* food, but an
  // unclassified item is never assumed compatible with a selected diet.
  if (!diet) return cls !== "unknown";
  if (diet === "vegan") return cls === "vegan";
  if (diet === "vegetarian") return cls === "vegan" || cls === "vegetarian";
  if (diet === "eggetarian") return cls === "vegan" || cls === "vegetarian" || cls === "eggetarian";
  if (diet === "non-vegetarian") return cls === "vegan" || cls === "vegetarian" || cls === "eggetarian" || cls === "non-vegetarian";
  return false;
}

const DAIRY_TERMS = ["dairy", "milk", "lactose", "cheese", "paneer", "curd", "yogurt", "yoghurt", "ghee", "butter", "cream"];
const GENERAL_DAIRY_TERMS = ["dairy", "milk", "lactose"];
const EGG_TERMS = ["egg"];
const MEAT_TERMS = ["chicken", "meat", "fish", "mutton", "beef", "pork", "seafood", "prawn"];

function normalizeTerm(term) {
  const t = String(term || "").toLowerCase().trim();
  return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
}

function cleanTerms(list) {
  return (list || []).map(normalizeTerm).filter(Boolean);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textHasTerm(text, term) {
  return new RegExp("\\b" + escapeRegExp(term)).test(String(text).toLowerCase());
}

// Does this food contain `term`? -> "contains" | "absent" | "unverified"
// "absent" requires CONFIRMED data (an allergen/ingredient list or a recorded
// dairy/egg/vegetarian flag). A name that simply doesn't mention the term proves nothing.
function assessTerm(combo, term) {
  const t = normalizeTerm(term);
  if (combo.items.some((item) => textHasTerm(item, t))) return "contains"; // conservative: the name mentions it
  if (Array.isArray(combo.allergens)) return combo.allergens.some((a) => textHasTerm(a, t)) ? "contains" : "absent";
  if (Array.isArray(combo.ingredients)) return combo.ingredients.some((i) => textHasTerm(i, t)) ? "contains" : "absent";
  if (DAIRY_TERMS.indexOf(t) >= 0) {
    if (combo.dairy === false) return "absent";
    // dairy:true only proves "some dairy" — enough for the general terms, not for a specific one (paneer, ghee...)
    if (combo.dairy === true && GENERAL_DAIRY_TERMS.indexOf(t) >= 0) return "contains";
  }
  if (EGG_TERMS.indexOf(t) >= 0) {
    if (combo.egg === true) return "contains";
    if (combo.egg === false) return "absent";
  }
  if (MEAT_TERMS.indexOf(t) >= 0) {
    if (combo.vegetarian === true) return "absent";
    if (combo.vegetarian === false && combo.egg !== true) return "contains";
  }
  return "unverified";
}

// The single safety check. Diet, allergies and avoided ingredients are NEVER relaxed
// by any fallback. An item whose ingredients can't be verified against a listed
// allergy is blocked — there is no opt-out, and nothing is ever called "safe".
function getEligibility(combo, profile) {
  const reasons = [];
  const cautions = [];
  if (!isMealAllowedForDiet(combo, profile.diet)) reasons.push("diet");

  const unverifiedAllergies = [];
  cleanTerms(profile.allergies).forEach((t) => {
    const r = assessTerm(combo, t);
    if (r === "contains") reasons.push("allergy:" + t);
    else if (r === "unverified") unverifiedAllergies.push(t);
  });
  if (unverifiedAllergies.length > 0) {
    // An opt-in checkbox cannot establish ingredient safety. Keep legacy profile
    // fields readable, but never let them bypass an unverified allergy check.
    reasons.push("allergy-unverified");
    cautions.push({ type: "allergy-unverified", terms: unverifiedAllergies });
  }

  const unverifiedAvoid = [];
  cleanTerms(profile.avoid).forEach((t) => {
    const r = assessTerm(combo, t);
    if (r === "contains") reasons.push("avoid:" + t);
    else if (r === "unverified") unverifiedAvoid.push(t);
  });
  if (unverifiedAvoid.length > 0) cautions.push({ type: "avoid-unverified", terms: unverifiedAvoid });

  return { eligible: reasons.length === 0, reasons, cautions };
}

function isComboAllowed(combo, profile, enforceSource) {
  if (!getEligibility(combo, profile).eligible) return false;
  if (enforceSource && !matchesSelectedSources(combo, profile)) return false;
  return true;
}

function matchesSelectedSources(combo, profile) {
  const sources = profile.sources || [];
  return sources.length === 0 || sources.indexOf(combo.source) >= 0;
}

// Candidate pipeline, in a fixed order so nothing can bypass the safety stage:
//   1. meal type  2. safety (diet/allergy/avoid — never relaxed)
//   3. the student's selected sources (only widened when they explicitly ask)
//   4. today's rotation (a soft preference; relaxed only among already-safe,
//      already-placed items)
function getCandidateStages(mealType, profile, dow, opts) {
  opts = opts || {};
  const base = MEAL_COMBOS.filter((c) => c.mealTypes.includes(mealType));
  const safe = base.filter((c) => getEligibility(c, profile).eligible);
  const placed = opts.allowAnySource ? safe : safe.filter((c) => matchesSelectedSources(c, profile));
  let final = placed;
  if (typeof dow === "number") {
    const today = placed.filter((c) => c.availableDays.includes(dow));
    if (today.length > 0) final = today;
  }
  return { base, safe, placed, final };
}

function getAvailableMeals(mealType, profile, dow, opts) {
  return getCandidateStages(mealType, profile, dow, opts).final;
}

// Why is there nothing to suggest? Honest, specific, and never a silent relaxation.
function explainNoResults(mealType, profile, dow) {
  const strict = getCandidateStages(mealType, profile, dow, {});
  const widened = getCandidateStages(mealType, profile, dow, { allowAnySource: true });
  const label = (MEAL_LABELS[mealType] || mealType).toLowerCase();
  if (strict.safe.length === 0) {
    const blockedByUnverified = strict.base.some((c) => getEligibility(c, profile).reasons.indexOf("allergy-unverified") >= 0);
    return {
      kind: "restrictions",
      canWiden: false,
      allergyUnverified: blockedByUnverified,
      message: blockedByUnverified
        ? `No ${label} option has confirmed ingredient information for your allergies, so we can't say any are safe.`
        : `No ${label} option on record fits your diet, allergies and avoided ingredients.`,
    };
  }
  if (strict.placed.length === 0) {
    return {
      kind: "sources",
      canWiden: widened.final.length > 0,
      allergyUnverified: false,
      message: `Nothing for ${label} at your selected places fits your diet and allergy settings.`,
    };
  }
  if (typeof profile.budgetLimit === "number") {
    const withoutBudget = getCandidateStages(mealType, { ...profile, budgetLimit: null }, dow, {}).final;
    if (withoutBudget.length > 0) {
      return { kind: "budget", canWiden: false, allergyUnverified: false, message: `No ${label} option has a confirmed price at or below ${formatINR(profile.budgetLimit)}. Try another selected location or adjust your per-meal budget.` };
    }
  }
  return { kind: "none", canWiden: false, allergyUnverified: false, message: `No ${label} options found.` };
}

function goalScore(combo, profile) {
  const strategy = getGoalStrategy(profile.goal);
  if (!strategy) return 0;
  let s = 0;
  combo.tags.forEach((t) => {
    if (strategy.weights[t]) s += strategy.weights[t];
  });
  if (profile.goal === "better-habits") {
    s += Math.max(0, 4 - combo.items.length) * 1.5;
    s += (combo.availableDays.length / 7) * 3;
  }
  return s;
}

function dietScore(combo, profile) {
  let s = 0;
  if (profile.diet === "non-vegetarian" && (combo.egg === true || combo.vegetarian === false)) s += 4;
  if (profile.diet === "eggetarian" && combo.egg) s += 3;
  if (profile.diet === "vegan" && combo.vegetarian && combo.dairy === false && combo.egg === false) s += 2;
  return s;
}

function sourceScore(combo, profile, mealType) {
  let s = 0;
  if (profile.sources && profile.sources.includes(combo.source)) s += 3;
  if (combo.source === "mess" && (mealType === "lunch" || mealType === "dinner")) s += 1;
  if (combo.source === "canteen" && (mealType === "snack" || mealType === "breakfast")) s += 1;
  if (combo.source === "cafe" && mealType === "breakfast") s += 1;
  if (combo.source === "hostel" && (mealType === "breakfast" || mealType === "snack")) s += 1;
  // Prefer a real, named campus menu item over a generic canteen/café combo
  // whenever both are otherwise viable — confirmed data beats a fictional default.
  if ((combo.source === "canteen" || combo.source === "cafe") && combo.locationId) s += 3;
  return s;
}

function availabilityScore(combo, dow) {
  if (typeof dow !== "number") return 0;
  return combo.availableDays.includes(dow) ? 2 : 0;
}

function preferenceScore(combo, profile) {
  let s = 0;
  const dislikes = (profile.dislikes || []).map((x) => x.toLowerCase().trim()).filter(Boolean);
  const likes = (profile.likes || []).map((x) => x.toLowerCase().trim()).filter(Boolean);
  if (combo.items.some((it) => dislikes.some((d) => it.toLowerCase().includes(d)))) s -= 6;
  if (combo.items.some((it) => likes.some((l) => it.toLowerCase().includes(l)))) s += 6;
  return s;
}

// Optional — never required. A small nudge toward campus spots the student
// actually said they prefer, on top of (not instead of) source matching.
function locationScore(combo, profile) {
  if (!combo.locationId) return 0;
  const preferred = profile.preferredLocations || [];
  if (preferred.length === 0) return 0;
  return preferred.includes(combo.locationId) ? 4 : 0;
}

function mealTimingScore(combo, mealType, opts) {
  opts = opts || {};
  let s = 0;
  if (opts.runningLate && combo.tags.includes("quick")) s += 8;
  // Between meal windows, nudge toward genuinely light/quick options rather
  // than a full meal that doesn't really fit the moment.
  if (opts.isBetween && (combo.tags.includes("quick") || combo.tags.includes("light"))) s += 4;
  return s;
}

function activityScore(combo, profile) {
  let s = 0;
  if ((profile.activity === "very-active" || profile.exercise === "5-plus") && combo.tags.includes("protein")) s += 3;
  if (profile.activity === "sedentary" && combo.tags.includes("light")) s += 1;
  return s;
}

function varietyScore(combo, recentIds) {
  return (recentIds || []).includes(combo.id) ? -5 : 0;
}

// Budget Mode — a soft nudge, not a hard cutoff (keeps the "better choices, not
// perfect choices" spirit). Items with no confirmed price are never penalized.
function budgetScore(combo, profile) {
  const minPrice = getMinPrice(combo);
  if (typeof profile.budgetLimit !== "number" || minPrice === null) return 0;
  return minPrice <= profile.budgetLimit ? 5 : -6;
}

function scoreCombo(combo, profile, context) {
  context = context || {};
  return (
    10 +
    goalScore(combo, profile) +
    dietScore(combo, profile) +
    sourceScore(combo, profile, context.mealType) +
    locationScore(combo, profile) +
    availabilityScore(combo, context.dow) +
    preferenceScore(combo, profile) +
    mealTimingScore(combo, context.mealType, context) +
    activityScore(combo, profile) +
    budgetScore(combo, profile) +
    varietyScore(combo, context.recentIds)
  );
}

function getRecommendedMeals(mealType, profile, dow, opts) {
  opts = opts || {};
  let pool = getAvailableMeals(mealType, profile, dow, opts);
  const limit = profile && profile.budgetLimit;
  // A stated per-meal budget is a real ceiling: unknown prices cannot be
  // represented as within-budget, and confirmed over-budget items are excluded.
  if (typeof limit === "number") pool = getBudgetMeals(pool, limit);
  const scored = pool.map((c) => ({ ...c, score: scoreCombo(c, profile, { ...opts, dow, mealType }) }));
  return scored.sort((a, b) => b.score - a.score);
}

function getQuickMeals(mealType, profile, dow, opts) {
  const scored = getRecommendedMeals(mealType, profile, dow, { ...(opts || {}), runningLate: true });
  const quick = scored.filter((c) => c.tags.includes("quick"));
  return quick.length > 0 ? quick : scored;
}

function getJunkOptions(profile, dow) {
  const results = [];
  MEAL_TYPES.forEach((mt) => {
    getBudgetMeals(getAvailableMeals(mt, profile, dow, {}), profile.budgetLimit).forEach((c) => {
      if (c.tags.includes("junk") && !results.find((r) => r.id === c.id)) results.push(c);
    });
  });
  return results.slice(0, 6);
}

function getAlternatives(currentId, mealType, profile, dow, opts) {
  return getRecommendedMeals(mealType, profile, dow, opts || {})
    .filter((c) => c.id !== currentId)
    .slice(0, 4);
}

function pickComboForSlot(mealType, profile, dow, opts) {
  const list = getRecommendedMeals(mealType, profile, dow, opts);
  return list.length > 0 ? list[0] : null;
}

function generateWeekPlan(profile) {
  const plan = {};
  for (let d = 0; d < 7; d++) plan[d] = {};
  MEAL_TYPES.forEach((mt) => {
    const recent = [];
    for (let d = 0; d < 7; d++) {
      const combo = pickComboForSlot(mt, profile, d, { recentIds: recent.slice(-2) });
      plan[d][mt] = combo ? combo.id : null;
      if (combo) recent.push(combo.id);
    }
  });
  return plan;
}

// Everything that should change what a plan contains. Weight, photo, etc. are deliberately absent.
function planFingerprint(profile) {
  return JSON.stringify([
    profile.diet, profile.allergies, profile.avoid, profile.sources,
    profile.preferredLocations, profile.budgetLimit, profile.goal, profile.activity, profile.exercise,
    profile.likes, profile.dislikes,
  ]);
}

// Replace any not-yet-eaten slot that is no longer valid for this profile (a saved plan can
// outlive a diet/allergy/source change). Completed slots are history and are left alone.
function sanitizeWeekPlan(plan, profile, completed) {
  if (!plan || Object.keys(plan).length === 0) return plan;
  const out = {};
  for (let d = 0; d < 7; d++) {
    out[d] = { ...(plan[d] || {}) };
    MEAL_TYPES.forEach((mt) => {
      const id = out[d][mt];
      if (!id || completed[`${d}-${mt}`]) return;
      const combo = getComboById(id);
      if (!combo || !isComboAllowed(combo, profile, true)) {
        const pick = pickComboForSlot(mt, profile, d, {});
        out[d][mt] = pick ? pick.id : null;
      }
    });
  }
  return out;
}

// Rebuild unfinished slots from the current profile; eaten slots keep what was eaten.
function rebuildWeekPlan(prev, profile, completed) {
  const fresh = generateWeekPlan(profile);
  const out = {};
  for (let d = 0; d < 7; d++) {
    out[d] = {};
    MEAL_TYPES.forEach((mt) => {
      out[d][mt] = completed[`${d}-${mt}`] ? (prev[d] ? prev[d][mt] : null) : fresh[d][mt];
    });
  }
  return out;
}

function isGoalAligned(combo, profile) {
  const strategy = getGoalStrategy(profile.goal);
  if (!strategy) return false;
  const entries = Object.entries(strategy.weights).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return !!(top && top[1] > 0 && combo.tags.includes(top[0]));
}

/* ----------------------------------------------------------------------
   HELPERS
---------------------------------------------------------------------- */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getComboById(id) {
  return MEAL_COMBOS.find((c) => c.id === id) || null;
}

function comboDisplay(combo, extraList) {
  if (!combo) return "—";
  const extras = (extraList || []).map((e) => e.charAt(0).toUpperCase() + e.slice(1));
  return [...combo.items, ...extras].join(" + ");
}

function comboBalanceLabel(combo) {
  if (!combo) return "";
  if (combo.tags.includes("junk")) return "Occasional treat";
  if (combo.tags.includes("protein")) return "Protein-rich";
  if (combo.tags.includes("balanced")) return "Balanced";
  if (combo.tags.includes("light")) return "Light";
  return "Everyday pick";
}

function getComboReason(combo, profile) {
  let trait = "Everyday pick";
  if (combo.tags.includes("junk")) trait = "Occasional treat";
  else if (combo.tags.includes("protein")) trait = "Protein-rich";
  else if (combo.tags.includes("balanced")) trait = "Balanced";
  else if (combo.tags.includes("light")) trait = "Light";
  else if (combo.tags.includes("quick")) trait = "Quick";

  const goalRelated =
    (profile.goal === "gain-muscle" && combo.tags.includes("protein")) ||
    (["lose-weight", "maintain-weight", "eat-healthier", "improve-energy"].includes(profile.goal) &&
      (combo.tags.includes("balanced") || combo.tags.includes("light")));

  let context;
  if (goalRelated) {
    context = "Matches your goal";
  } else {
    const location = combo.locationId ? getFoodLocation(combo.locationId) : null;
    context = location ? `On the ${location.name} menu` : `From your ${SOURCE_CONTEXT[combo.source] || combo.source}`;
  }
  return `${trait} · ${context}`;
}

// Fuller, natural-language explanation for the "Why this?" hero card. Only ever
// names things the data actually supports — never a health/nutrition claim we
// can't back up (no "high protein" unless the protein tag is genuinely there).
function getRecommendationReason(combo, profile, context) {
  context = context || {};
  const descriptors = [];
  if (combo.tags.includes("quick")) descriptors.push("quick");
  if (combo.tags.includes("budget")) descriptors.push("budget-friendly");
  if (isGoalAligned(combo, profile)) descriptors.push("goal-friendly");
  if (combo.tags.includes("balanced")) descriptors.push("balanced");
  if (combo.tags.includes("protein") && (profile.goal === "gain-muscle" || profile.activity === "very-active" || profile.exercise === "5-plus")) {
    descriptors.push("protein-rich");
  }

  const lead =
    descriptors.length === 0
      ? "It's a solid option"
      : descriptors.length === 1
      ? `It's a ${descriptors[0]} option`
      : `It's a ${descriptors.join(", ")} option`;

  const extras = ["fits your current meal window"];
  if (profile.diet) extras.push("your dietary preference");
  if (context.isVariety) extras.push("gives you some variety from what you've had recently");

  const tail = extras.length === 1 ? extras[0] : `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}`;

  let sentence = `${lead} that ${tail}.`;
  if (combo.tags.includes("junk")) sentence += " It's fine to enjoy this sometimes — better choices, not perfect ones.";
  return sentence;
}

function describeIneligibility(reasons) {
  return reasons
    .map((r) => {
      if (r === "diet") return "your diet";
      if (r === "allergy-unverified") return "allergen info unconfirmed";
      if (r.indexOf("allergy:") === 0) return `contains ${r.slice(8)} (allergy)`;
      if (r.indexOf("avoid:") === 0) return `contains ${r.slice(6)}`;
      return r;
    })
    .join(", ");
}

// What a card must be honest about. Built only from what the data actually lacks or flags:
// nothing here is an estimate, and nothing here ever says "safe".
function getUncertaintyNotes(combo, profile) {
  const notes = [];
  if (getDietClass(combo) === "unknown") notes.push("Dietary classification unconfirmed");
  if (formatPrice(combo) === null) notes.push("Price not confirmed");
  if (combo.locationId) notes.push("Ingredients and live availability aren't confirmed");
  else notes.push("Typical dish — not a confirmed campus menu entry");
  const { cautions } = getEligibility(combo, profile || {});
  cautions.forEach((c) => {
    if (c.type === "allergy-unverified") notes.push(`Can't confirm it's free of ${c.terms.join(", ")} — check with the vendor`);
    if (c.type === "avoid-unverified") notes.push(`Ingredients unconfirmed for: ${c.terms.join(", ")}`);
  });
  return notes;
}

function getGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Section 3 — real meal windows (minute precision). Gaps between windows are
// intentionally NOT labeled as the nearest meal; getMealContext() below
// surfaces that distinction explicitly instead of guessing.
const MEAL_WINDOWS = {
  breakfast: { startMin: 7 * 60, endMin: 10 * 60 },
  lunch: { startMin: 12 * 60 + 30, endMin: 15 * 60 },
  snack: { startMin: 16 * 60, endMin: 18 * 60 },
  dinner: { startMin: 19 * 60 + 30, endMin: 22 * 60 },
};

// One distinct key per real segment of the day (4 meals + 4 gaps, with the
// overnight gap spanning midnight treated as a single segment). Used to reset
// "show me something else" skip state exactly when the window truly changes —
// two different gaps must not be treated as the same window just because they
// both fall back to the same underlying engine mealType.
function getMealWindowKey(now) {
  const d = now || new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  if (m >= MEAL_WINDOWS.breakfast.startMin && m < MEAL_WINDOWS.breakfast.endMin) return "breakfast";
  if (m >= MEAL_WINDOWS.breakfast.endMin && m < MEAL_WINDOWS.lunch.startMin) return "gap-morning";
  if (m >= MEAL_WINDOWS.lunch.startMin && m < MEAL_WINDOWS.lunch.endMin) return "lunch";
  if (m >= MEAL_WINDOWS.lunch.endMin && m < MEAL_WINDOWS.snack.startMin) return "gap-afternoon";
  if (m >= MEAL_WINDOWS.snack.startMin && m < MEAL_WINDOWS.snack.endMin) return "snack";
  if (m >= MEAL_WINDOWS.snack.endMin && m < MEAL_WINDOWS.dinner.startMin) return "gap-evening";
  if (m >= MEAL_WINDOWS.dinner.startMin && m < MEAL_WINDOWS.dinner.endMin) return "dinner";
  return "gap-night";
}

// mealType is always a valid engine key (a real gap falls back to "snack",
// since light/quick items are the right thing to recommend between meals);
// label/isBetween are for display only, so "Between meals" is never dressed
// up as "Breakfast time" or similar.
function getMealContext(now) {
  const windowKey = getMealWindowKey(now);
  const isBetween = windowKey.indexOf("gap") === 0;
  const mealType = isBetween ? "snack" : windowKey;
  return { mealType, label: MEAL_LABELS[mealType], isBetween, windowKey };
}

function getWeekDates() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatShortDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildMonthMatrix(monthCursor) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Progress dots come ONLY from the saved completion history. A day with nothing logged
// shows nothing — never an invented "completed".
function getDayProgress(date, mealHistory) {
  const done = getCompletedCountOn(mealHistory || [], dateKeyOf(date));
  return { done, kind: done >= MEAL_TYPES.length ? "done" : done > 0 ? "partial" : "none" };
}

function findLabel(list, id, fallback) {
  const found = list.find((x) => x.id === id);
  return found ? found.label : fallback;
}

/* ---- Food locations (Anna Canteen etc.) — Sections 1, 21 ---- */

function getFoodLocation(locationId) {
  return FOOD_LOCATIONS.find((l) => l.id === locationId) || null;
}

function getLocationMenu(locationId) {
  return MEAL_COMBOS.filter((c) => c.locationId === locationId);
}

// Menu items from a location that are actually allowed/available right now —
// same allow-rules as the main engine (diet + day), just scoped to one place.
function getAvailableLocationItems(locationId, profile, dow) {
  return getLocationMenu(locationId).filter(
    (c) => isComboAllowed(c, profile, false) && (typeof dow !== "number" || c.availableDays.includes(dow))
  );
}

// "Anna Canteen" when we know exactly where it's from, otherwise the generic
// source label ("College Canteen") — used everywhere a combo's source is shown.
function getSourceDisplayLabel(combo) {
  if (combo.locationId) {
    const location = getFoodLocation(combo.locationId);
    if (location) return location.name;
  }
  return SOURCE_LABELS[combo.source] || combo.source;
}

function formatINR(price) {
  return `₹${price}`;
}

// An item normally has one confirmed `price`. When the menu lists several
// prices for the same item without saying why (e.g. Jeera Rice ₹40 / ₹60),
// `priceOptions` holds every confirmed price and `price` is the lowest — used
// for budget logic. Display always goes through formatPrice() so no option is
// hidden and no size/variant label is invented.
function getPriceOptions(combo) {
  if (Array.isArray(combo.priceOptions) && combo.priceOptions.length > 0) return combo.priceOptions;
  return typeof combo.price === "number" ? [combo.price] : [];
}

function getMinPrice(combo) {
  const options = getPriceOptions(combo);
  return options.length > 0 ? Math.min(...options) : null;
}

function formatPrice(combo) {
  const options = getPriceOptions(combo);
  return options.length > 0 ? options.map(formatINR).join(" / ") : null;
}

// Compact "Location · ₹Price" (or just location if price is unknown) for list rows.
function getSourceTagText(combo) {
  const label = getSourceDisplayLabel(combo);
  const price = formatPrice(combo);
  return price ? `${label} · ${price}` : label;
}

// Section 4/5 — parcel/takeaway surcharge, disclosed separately, never folded into price.
function getParcelChargeLabel(location) {
  if (!location || typeof location.parcelCharge !== "number") return null;
  return `+${formatINR(location.parcelCharge)} for parcel`;
}

// Section 13 — never claim "open now" without real hours.
function getLocationAvailabilityLabel(location) {
  if (!location) return null;
  if (!location.openingTime || !location.closingTime) return "Availability not set";
  return `${location.openingTime} – ${location.closingTime}`;
}

/* ---- Budget filtering (Section 12) — dynamic, not per-bracket arrays ---- */

function getBudgetMeals(items, maxPrice) {
  if (typeof maxPrice !== "number") return items;
  return items.filter((c) => {
    const minPrice = getMinPrice(c);
    return minPrice !== null && minPrice <= maxPrice;
  });
}

/* ---- Completion history: exactly one record per date + meal slot ---- */

function dateKeyOf(date) {
  const d = date || new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function recordDateKey(rec) {
  return rec.date || (rec.timestamp ? dateKeyOf(new Date(rec.timestamp)) : null);
}

// Idempotent: tapping "ate this" repeatedly, or eating a different item for the
// same slot, replaces the slot's record instead of adding another.
function upsertCompletion(history, { comboId, day, mealType, dateKey }) {
  const rest = history.filter((r) => !(recordDateKey(r) === dateKey && r.mealType === mealType));
  return [...rest, { id: `${dateKey}-${mealType}`, comboId, day, mealType, date: dateKey, timestamp: Date.now() }];
}

function removeCompletion(history, dateKey, mealType) {
  return history.filter((r) => !(recordDateKey(r) === dateKey && r.mealType === mealType));
}

// Distinct meal slots completed on a date, from the real history only.
function getCompletedCountOn(history, dateKey) {
  const slots = new Set();
  history.forEach((r) => {
    if (recordDateKey(r) === dateKey) slots.add(r.mealType);
  });
  return slots.size;
}

// Rebuild this week's { "<weekday>-<meal>": true } map from the real history.
function deriveCompletedForWeek(history, weekDates) {
  const out = {};
  weekDates.forEach((d, i) => {
    const key = dateKeyOf(d);
    history.forEach((r) => {
      if (recordDateKey(r) === key) out[`${i}-${r.mealType}`] = true;
    });
  });
  return out;
}

/* ---- Meal history / variety (Sections 7, 18) ---- */

// Most-recent-first list of distinct combo ids actually eaten, for variety scoring.
function getRecentMeals(mealHistory, limit) {
  const seen = [];
  for (let i = mealHistory.length - 1; i >= 0 && seen.length < limit; i--) {
    const id = mealHistory[i] && mealHistory[i].comboId;
    if (id && !seen.includes(id)) seen.push(id);
  }
  return seen;
}

/* ----------------------------------------------------------------------
   PERSISTENCE  (artifact key/value storage — NOT localStorage)
   Same signatures this will need once swapped for Supabase.
---------------------------------------------------------------------- */

const STORAGE_KEYS = {
  STATE: "dietyaar:app-state",
  PHOTO: "dietyaar:profile-photo",
};

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

async function loadAppState() {
  if (!hasStorage()) return null;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS.STATE);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("DietYaar: Could not load app data", error);
    return null;
  }
}

async function saveAppState(state) {
  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.STATE,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error("DietYaar: Could not save app data", error);
  }
}

async function loadProfilePhoto() {
  if (!hasStorage()) return null;

  try {
    return window.localStorage.getItem(STORAGE_KEYS.PHOTO);
  } catch (error) {
    console.error("DietYaar: Could not load profile photo", error);
    return null;
  }
}

async function saveProfilePhotoToStorage(dataUrl) {
  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.PHOTO, dataUrl);
  } catch (error) {
    console.error("DietYaar: Could not save profile photo", error);
  }
}

async function removeProfilePhotoFromStorage() {
  if (!hasStorage()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEYS.PHOTO);
  } catch (error) {
    console.error("DietYaar: Could not remove profile photo", error);
  }
}

async function clearAllStorage() {
  if (!hasStorage()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEYS.STATE);
    window.localStorage.removeItem(STORAGE_KEYS.PHOTO);
  } catch (error) {
    console.error("DietYaar: Could not clear app data", error);
  }
}


function resizeImageFile(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Future signature-compatible replacement: Supabase Storage upload.
async function uploadProfilePhoto(userId, file) {
  const dataUrl = await resizeImageFile(file, 400);
  await saveProfilePhotoToStorage(dataUrl);
  return dataUrl;
}

/* ----------------------------------------------------------------------
   GLOBAL STYLES
---------------------------------------------------------------------- */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');

      :root {
        /* Palette — do not introduce colors outside this set */
        --primary: #3368A0;
        --secondary: #66A3BF;
        --mint: #C8DFDB;
        --bg: #F2EFE7;
        --card: #FFFFFF;
        --surface: #EAE6D9;
        --text: #18212B;
        --text-secondary: #66727C;
        --border: rgba(51,104,160,0.14);
        --primary-light: rgba(51,104,160,0.10);
        --mint-tint: rgba(200,223,219,0.55);
        --secondary-tint: rgba(102,163,191,0.16);
        --on-primary: #FFFFFF;
        /* Functional (non-decorative) — validation errors only */
        --error: #C0392B;
        --error-tint: rgba(192,57,43,0.08);

        /* Type */
        --font-serif: 'Fraunces', Georgia, serif;
        --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

        /* Spacing scale */
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --space-5: 20px;
        --space-6: 24px;
        --space-7: 32px;
        --space-8: 40px;

        /* Radius scale */
        --radius-sm: 14px;
        --radius-md: 20px;
        --radius-lg: 28px;
        --radius-pill: 999px;

        /* Shadow scale */
        --shadow-sm: 0 1px 2px rgba(24,33,43,0.04);
        --shadow-md: 0 8px 22px rgba(24,33,43,0.08);
        --shadow-lg: 0 18px 44px rgba(24,33,43,0.12);
      }

      .dy-root, .dy-root * { box-sizing: border-box; }
      .dy-root { -webkit-font-smoothing: antialiased; }
      .dy-root button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; text-align: inherit; }
      .dy-root input, .dy-root textarea { font-family: inherit; }
      .dy-root button:disabled { cursor: not-allowed; }
      .dy-root button:focus-visible,
      .dy-root input:focus-visible,
      .dy-root a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .dy-root h1, .dy-root h2, .dy-root h3, .dy-root p { margin: 0; }

      .app-main { max-width: 1120px; margin: 0 auto; padding: 0 20px 110px; }
      @media (min-width: 768px) { .app-main { padding: 0 32px 56px; } }
      .app-main.landing-page { max-width: 1120px; padding-bottom: 0; }

      .animate-page { animation: pageIn .35s cubic-bezier(.22,1,.36,1); }
      @keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .stagger > * { animation: pageIn .4s cubic-bezier(.22,1,.36,1) backwards; }
      .stagger > *:nth-child(1) { animation-delay: .02s; }
      .stagger > *:nth-child(2) { animation-delay: .06s; }
      .stagger > *:nth-child(3) { animation-delay: .10s; }
      .stagger > *:nth-child(4) { animation-delay: .14s; }
      .stagger > *:nth-child(5) { animation-delay: .18s; }

      .card { background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 20px; box-shadow: 0 1px 2px rgba(24,33,43,0.03); }
      .card-hover { transition: box-shadow .2s cubic-bezier(.22,1,.36,1), transform .2s cubic-bezier(.22,1,.36,1); }
      .card-hover:hover { box-shadow: 0 10px 26px rgba(24,33,43,0.08); transform: translateY(-3px); }
      .card-hover:active { transform: scale(0.98); box-shadow: 0 4px 12px rgba(24,33,43,0.06); }

      .boot-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: var(--bg); }
      .boot-mark { font-weight: 700; font-size: 20px; letter-spacing: -0.01em; color: var(--text); }

      .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--primary); color: #fff; padding: 14px 28px; border-radius: 999px; font-weight: 600; font-size: 15px; transition: opacity .15s ease, transform .15s cubic-bezier(.22,1,.36,1), box-shadow .15s ease; box-shadow: 0 6px 16px rgba(51,104,160,0.22); }
      .btn-primary:hover:not(:disabled) { opacity: .94; transform: translateY(-1px); }
      .btn-primary:active:not(:disabled) { transform: scale(0.97); }
      .btn-primary:disabled { opacity: .4; box-shadow: none; }

      .btn-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--card); color: var(--text); padding: 14px 28px; border-radius: 999px; font-weight: 600; font-size: 15px; border: 1px solid var(--border); transition: background .15s ease, transform .15s cubic-bezier(.22,1,.36,1); }
      .btn-secondary:hover { background: var(--primary-light); border-color: var(--primary); }
      .btn-secondary:active { transform: scale(0.97); }

      .btn-tertiary { display: inline-flex; align-items: center; gap: 6px; color: var(--primary); font-weight: 600; font-size: 14px; padding: 4px 0; }
      .btn-tertiary:hover { text-decoration: underline; }

      .btn-danger { background: var(--error); color: #fff; padding: 14px 20px; border-radius: 999px; font-weight: 600; font-size: 14px; transition: opacity .15s ease; }
      .btn-danger:hover { opacity: .9; }

      .btn-chip { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 14px; border: 1px solid var(--border); font-size: 13px; font-weight: 500; background: var(--card); transition: border-color .15s ease, background .15s ease, color .15s ease, transform .15s ease; }
      .btn-chip:hover { border-color: var(--primary); }
      .btn-chip:active { transform: scale(0.96); }
      .btn-chip-done { background: var(--primary); border-color: var(--primary); color: #fff; }

      .icon-btn { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); flex-shrink: 0; transition: background .15s ease; }
      .icon-btn:hover { background: var(--surface); }

      .input-field { width: 100%; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--card); font-size: 15px; color: var(--text); transition: border-color .15s ease, box-shadow .15s ease; }
      .input-field:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
      .input-field-error { border-color: var(--error); }
      .input-field-error:focus { box-shadow: 0 0 0 3px var(--error-tint); }
      .field-error { color: var(--error); font-size: 12px; margin-top: 6px; font-weight: 500; }
      .field-required-mark { color: var(--primary); }

      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); font-size: 13px; font-weight: 500; color: var(--text-secondary); transition: all .15s ease; }
      .chip:hover { border-color: var(--primary); }
      .chip:active { transform: scale(0.95); }
      .chip-active { background: var(--primary); border-color: var(--primary); color: #fff; }

      .segmented { display: inline-flex; background: var(--surface); padding: 4px; border-radius: 16px; gap: 4px; flex-wrap: wrap; }
      .segmented-btn { padding: 8px 18px; border-radius: 12px; font-size: 14px; font-weight: 500; color: var(--text-secondary); transition: all .15s ease; }
      .segmented-btn-active { background: var(--card); color: var(--primary); box-shadow: 0 1px 4px rgba(24,33,43,0.08); }

      .switch { width: 46px; height: 28px; border-radius: 999px; background: var(--border); position: relative; transition: background .2s ease; flex-shrink: 0; }
      .switch-on { background: var(--primary); }
      .switch-thumb { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(24,33,43,0.25); transition: transform .2s cubic-bezier(.22,1,.36,1); }
      .switch-on .switch-thumb { transform: translateX(18px); }

      .option-card { display: flex; align-items: center; gap: 12px; width: 100%; padding: 15px 16px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); transition: all .15s ease; }
      .option-card:hover { border-color: var(--primary); }
      .option-card:active { transform: scale(0.98); }
      .option-card-selected { border-color: var(--primary); background: var(--primary-light); }
      .option-card-icon-wrap { width: 36px; height: 36px; border-radius: 12px; background: var(--primary-light); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
      .option-card-label { font-weight: 500; font-size: 14px; display: block; }
      .option-card-desc { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 2px; font-weight: 400; }

      .option-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
      @media (max-width: 480px) { .option-grid { grid-template-columns: 1fr; } }

      .strategy-hint { font-size: 12.5px; color: var(--text-secondary); background: var(--surface); padding: 10px 14px; border-radius: 12px; margin-top: 12px; line-height: 1.5; }

      .field-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; display: block; }
      .field-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
      @media (max-width: 420px) { .field-row { grid-template-columns: 1fr; } }
      .field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      .sheet-overlay { position: fixed; inset: 0; background: rgba(24,33,43,0.44); display: flex; align-items: flex-end; justify-content: center; z-index: 60; animation: fadeIn .2s ease; padding: 0; }
      .sheet-panel { background: var(--card); width: 100%; max-width: 520px; max-height: 88vh; border-radius: 28px 28px 0 0; padding: 20px 20px 28px; box-shadow: 0 -14px 40px rgba(24,33,43,0.16); }
      @media (min-width: 640px) { .sheet-overlay { align-items: center; } .sheet-panel { border-radius: 28px; } }
      .sheet-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 16px; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .animate-sheet-up { animation: slideUp .3s cubic-bezier(.22,1,.36,1); }
      .sheet-body { max-height: 68vh; overflow-y: auto; }

      .toast { position: fixed; bottom: 96px; left: 50%; transform: translateX(-50%); background: var(--text); color: #fff; padding: 11px 20px; border-radius: 999px; font-size: 14px; font-weight: 500; z-index: 70; box-shadow: 0 8px 24px rgba(24,33,43,0.28); animation: toastIn .3s cubic-bezier(.22,1,.36,1); }
      @media (min-width: 768px) { .toast { bottom: 32px; } }
      @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

      .mobile-header { display: flex; align-items: center; padding: 16px 20px 4px; }
      @media (min-width: 768px) { .mobile-header { display: none; } }

      .topnav { display: none; }
      @media (min-width: 768px) {
        .topnav { display: block; position: sticky; top: 0; z-index: 40; background: rgba(242,239,231,0.86); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
      }
      .topnav-inner { max-width: 1120px; margin: 0 auto; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
      .brand { font-family: var(--font-serif); font-weight: 600; font-size: 19px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; transition: opacity .15s ease; }
      .brand:hover { opacity: .72; }
      .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); display: inline-block; }
      .nav-link { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 14px; color: var(--text-secondary); font-weight: 500; font-size: 14px; transition: all .15s ease; }
      .nav-link:hover { color: var(--text); }
      .nav-link-active { background: var(--primary-light); color: var(--primary); }

      .bottomnav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: rgba(255,255,255,0.94); backdrop-filter: blur(12px); border-top: 1px solid var(--border); padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); z-index: 40; }
      @media (min-width: 768px) { .bottomnav { display: none; } }
      .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; flex: 1; color: var(--text-secondary); font-size: 11px; font-weight: 500; }
      .bottom-nav-item svg { transition: transform .2s cubic-bezier(.22,1,.36,1); }
      .bottom-nav-item-active { color: var(--primary); }
      .bottom-nav-item-active svg { transform: scale(1.14); }

      /* Landing */
      .landing-hero { display: flex; flex-wrap: wrap; gap: 48px; align-items: center; justify-content: space-between; padding: 52px 0 60px; position: relative; }
      .eyebrow { color: var(--primary); font-weight: 600; font-size: 13px; letter-spacing: .02em; margin-bottom: 14px; }
      .hero-title { font-family: var(--font-serif); font-size: 40px; line-height: 1.14; font-weight: 600; letter-spacing: -0.01em; }
      @media (min-width: 640px) { .hero-title { font-size: 50px; } }
      .hero-sub { color: var(--text-secondary); font-size: 17px; line-height: 1.6; margin-top: 16px; max-width: 440px; }
      .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
      .demo-link { margin-top: 18px; color: var(--text-secondary); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; display: block; }
      .demo-link:hover { color: var(--text); }

      .floating-visual { position: relative; width: 300px; max-width: 100%; height: 340px; flex-shrink: 0; }
      .floating-blob { position: absolute; border-radius: 50%; filter: blur(42px); opacity: .6; z-index: 0; }
      .floating-blob-1 { width: 220px; height: 220px; background: var(--mint); top: -30px; right: -40px; }
      .floating-blob-2 { width: 170px; height: 170px; background: var(--secondary); opacity: .3; bottom: -20px; left: -30px; }
      .floating-card { position: absolute; background: var(--card); border: 1px solid var(--border); border-radius: 24px; box-shadow: 0 20px 44px rgba(24,33,43,0.12); }
      .floating-card-main { top: 34px; left: 8px; width: 260px; padding: 20px; z-index: 2; }
      .floating-card-back { top: 0; right: 6px; width: 118px; padding: 14px; display: flex; flex-direction: column; gap: 8px; transform: rotate(6deg); z-index: 1; opacity: .95; }
      .floating-card-back-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
      .floating-card-ring { bottom: -6px; left: -16px; padding: 10px; z-index: 3; display: flex; align-items: center; justify-content: center; transform: rotate(-4deg); }

      .mock-visual-header { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 14px; }
      .mock-visual-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
      .mock-visual-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-top: 1px solid var(--border); }
      .mock-visual-row:first-of-type { border-top: none; }
      .mock-visual-label { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
      .mock-visual-value { font-size: 14px; font-weight: 500; margin-top: 2px; }

      .feature-grid { display: grid; grid-template-columns: 1fr; gap: 16px; padding: 24px 0 40px; }
      @media (min-width: 640px) { .feature-grid { grid-template-columns: 1fr 1fr; } }
      .feature-card { display: flex; flex-direction: column; gap: 6px; }
      .feature-icon { width: 40px; height: 40px; border-radius: 14px; background: var(--mint-tint); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
      .feature-title { font-weight: 600; font-size: 15px; }
      .feature-desc { color: var(--text-secondary); font-size: 13px; line-height: 1.55; }

      .how-section { padding: 48px 0 64px; border-top: 1px solid var(--border); margin-top: 8px; }
      .section-heading { font-family: var(--font-serif); font-size: 28px; font-weight: 600; margin-bottom: 28px; text-align: center; letter-spacing: -0.01em; }
      .how-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      @media (min-width: 640px) { .how-grid { grid-template-columns: repeat(3, 1fr); } }
      .how-number { width: 30px; height: 30px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; margin-bottom: 12px; }

      .landing-footer { display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center; padding: 32px 0 40px; color: var(--text-secondary); font-size: 13px; border-top: 1px solid var(--border); }

      /* Onboarding */
      .onboarding-wrap { max-width: 480px; margin: 0 auto; padding: 40px 20px 60px; }
      .onboarding-brand { display: flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-serif); font-weight: 600; font-size: 18px; margin-bottom: 24px; }
      .onboarding-panel { padding: 32px 28px; }
      @media (min-width: 480px) { .onboarding-panel { padding: 40px 36px; } }
      .onboarding-progress { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
      .onboarding-progress-fill { height: 100%; background: var(--primary); transition: width .35s cubic-bezier(.22,1,.36,1); }
      .onboarding-step-label { font-size: 12px; color: var(--text-secondary); margin: 10px 0 26px; font-weight: 500; }
      .step-title { font-family: var(--font-serif); font-size: 26px; font-weight: 600; margin-bottom: 6px; letter-spacing: -0.01em; }
      .step-sub { color: var(--text-secondary); font-size: 14px; margin-bottom: 22px; }
      .onboarding-nav { display: flex; align-items: center; gap: 12px; margin-top: 32px; }

      .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; color: var(--text-secondary); font-weight: 500; text-align: center; }
      .loading-spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid var(--border); border-top-color: var(--primary); animation: spin .8s linear infinite; margin-bottom: 18px; }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Skeletons */
      .skeleton-block { border-radius: 8px; background: linear-gradient(90deg, var(--surface) 25%, #F6F4EC 37%, var(--surface) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
      @keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

      /* Dashboard */
      .dash-header { margin: 28px 0 26px; }
      .dash-greeting { font-family: var(--font-serif); font-size: 28px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }

      /* "What should you eat right now?" */
      .right-now-section { margin-bottom: var(--space-6); }
      .right-now-title { font-family: var(--font-serif); font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
      .time-pill { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--space-3); font-size: 12.5px; font-weight: 600; color: var(--primary); background: var(--primary-light); padding: 6px 12px; border-radius: var(--radius-pill); }
      .right-now-lead { color: var(--text-secondary); font-size: 14px; margin-top: var(--space-3); margin-bottom: var(--space-5); }

      .recs-grid { display: flex; flex-direction: column; gap: var(--space-4); }
      .recs-secondary-row { display: grid; grid-template-columns: 1fr; gap: var(--space-4); }
      @media (min-width: 640px) { .recs-secondary-row { grid-template-columns: 1fr 1fr; } }

      .rec-card-v2 { display: flex; flex-direction: column; }
      .rec-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
      .rec-card-name { font-family: var(--font-serif); font-size: 19px; font-weight: 600; line-height: 1.25; }
      .rec-card-price { font-size: 15px; font-weight: 700; white-space: nowrap; }
      .rec-card-location { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-secondary); margin-top: var(--space-2); }
      .rec-card-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-3); }
      .pill-tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; background: var(--surface); color: var(--text-secondary); padding: 4px 10px; border-radius: var(--radius-pill); }
      .rec-card-why { background: var(--mint-tint); border-radius: var(--radius-sm); padding: var(--space-4); margin-top: var(--space-4); }
      .rec-card-why-label { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
      .rec-card-why-text { font-size: 13.5px; color: var(--text); line-height: 1.5; }
      .rec-card-reason { font-size: 13px; color: var(--text-secondary); margin-top: var(--space-3); line-height: 1.4; }
      .rec-card-note { font-size: 11.5px; color: var(--text-secondary); font-style: italic; margin-top: var(--space-2); }
      .rec-card-eat { display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin-top: var(--space-4); padding: 11px 18px; border-radius: var(--radius-pill); font-weight: 600; font-size: 13.5px; background: var(--primary-light); color: var(--primary); align-self: flex-start; transition: opacity .15s ease, transform .15s ease; }
      .rec-card-eat:hover { opacity: .85; }
      .rec-card-eat:active { transform: scale(0.96); }

      .rec-card-featured { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
      .rec-card-featured .rec-card-price { color: var(--on-primary); }
      .rec-card-featured .rec-card-location { color: rgba(255,255,255,0.82); }
      .rec-card-featured .pill-tag { background: rgba(255,255,255,0.16); color: var(--on-primary); }
      .rec-card-featured .rec-card-why { background: rgba(255,255,255,0.12); }
      .rec-card-featured .rec-card-why-label { color: rgba(255,255,255,0.85); }
      .rec-card-featured .rec-card-why-text { color: var(--on-primary); }
      .rec-card-featured .rec-card-note { color: rgba(255,255,255,0.75); }
      .rec-card-featured .rec-card-eat { background: var(--on-primary); color: var(--primary); align-self: stretch; padding: 13px 18px; font-size: 14px; }

      .swap-flag { font-size: 11.5px; font-weight: 600; color: var(--primary); margin-top: 3px; }
      .allergy-box { background: var(--surface); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 10px; }
      .allergy-box p { font-size: 12.5px; line-height: 1.5; color: var(--text); margin: 0; }
      .allergy-fine { font-size: 11.5px !important; color: var(--text-secondary) !important; margin-top: 8px !important; }
      .notice { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 12.5px; line-height: 1.45; color: var(--text); background: var(--secondary-tint); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: var(--space-4); }
      .empty-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
      .show-else-btn { display: flex; justify-content: center; width: 100%; margin-top: var(--space-4); }

      /* Meals today / BMI / Budget mode */
      .stats-row { display: grid; grid-template-columns: 1fr; gap: var(--space-3); margin: var(--space-6) 0; }
      @media (min-width: 640px) { .stats-row { grid-template-columns: repeat(3, 1fr); } }
      .stat-card { padding: var(--space-4) var(--space-5); width: 100%; }
      .stat-card-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
      .stat-card-value { font-size: 24px; font-weight: 700; margin-top: var(--space-2); letter-spacing: -0.01em; }
      .stat-card-sub { font-size: 12.5px; color: var(--text-secondary); margin-top: 4px; }
      .stat-card-foot { font-size: 11px; color: var(--text-secondary); margin-top: var(--space-2); }

      /* Craving / weekly progress teasers */
      .teaser-row { display: grid; grid-template-columns: 1fr; gap: var(--space-3); margin: var(--space-6) 0; }
      @media (min-width: 640px) { .teaser-row { grid-template-columns: 1fr 1fr; } }
      .teaser-card { padding: var(--space-5); width: 100%; }
      .teaser-label { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .04em; }
      .teaser-title { font-family: var(--font-serif); font-size: 17px; font-weight: 600; margin-top: var(--space-2); }
      .teaser-sub { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

      .checkin-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface); border-radius: var(--radius-sm); padding: 14px 16px; flex-wrap: wrap; }
      .progress-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .progress-stat { background: var(--surface); border-radius: 14px; padding: 12px 14px; }
      .progress-stat-label { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
      .progress-stat-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
      .progress-stat-note { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; font-weight: 500; }
      .progress-change { text-align: center; font-size: 13px; color: var(--text-secondary); font-weight: 500; margin-top: 14px; }
      .chart-empty { font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0; }

      .meal-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 4px; }
      @media (min-width: 640px) { .meal-grid { grid-template-columns: 1fr 1fr; } }
      @media (min-width: 1024px) { .meal-grid { grid-template-columns: repeat(4, 1fr); } }
      .meal-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .meal-type-label { font-weight: 600; font-size: 14px; }
      .source-tag { font-size: 12px; color: var(--text-secondary); background: var(--surface); padding: 4px 10px; border-radius: 999px; }
      .meal-items { font-size: 16px; font-weight: 500; line-height: 1.4; min-height: 44px; }
      .balance-pill { display: inline-block; margin-top: 10px; font-size: 12px; color: var(--primary); background: var(--primary-light); padding: 4px 10px; border-radius: 999px; font-weight: 500; }
      .meal-card-actions { display: flex; gap: 8px; margin-top: 14px; }
      .junk-note { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border); }
      .junk-note-title { font-weight: 600; font-size: 14px; }
      .junk-note-text { color: var(--text-secondary); font-size: 13px; margin-top: 2px; }
      .meal-card-done { background: var(--mint-tint); border-color: var(--mint); }
      .meal-card-missed { opacity: .72; }
      .btn-chip-missed { background: var(--surface); border-color: var(--text-secondary); }

      /* Plan */
      .page-title { font-family: var(--font-serif); font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }
      .page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
      .section-header { margin-bottom: 20px; }
      .section-header-with-action { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
      .day-card { padding: 16px; }
      .day-card-today { border-color: var(--primary); }
      .day-card-header { display: flex; align-items: center; justify-content: space-between; width: 100%; }
      .day-badge { width: 40px; height: 40px; border-radius: 14px; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
      .today-tag { margin-left: 8px; font-size: 11px; background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
      .day-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
      .day-body { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); animation: pageIn .25s cubic-bezier(.22,1,.36,1); }
      .day-meals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      @media (min-width: 640px) { .day-meals-grid { grid-template-columns: repeat(4, 1fr); } }
      .mini-meal { background: var(--surface); border-radius: 16px; padding: 12px; }
      .mini-meal-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
      .meal-type-label-sm { font-size: 11px; font-weight: 600; color: var(--text-secondary); letter-spacing: .02em; }
      .mini-meal-badges { display: flex; align-items: center; gap: 4px; }
      .treat-badge { font-size: 10px; background: var(--mint-tint); color: var(--primary); padding: 2px 7px; border-radius: var(--radius-pill); font-weight: 600; }
      .align-badge { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--primary-light); color: var(--primary); flex-shrink: 0; }
      .mini-meal-items { font-size: 13px; font-weight: 500; margin-top: 6px; min-height: 34px; line-height: 1.35; }
      .mini-meal-source { font-size: 10px; color: var(--text-secondary); margin-top: 2px; }
      .mini-meal-actions { display: flex; gap: 6px; margin-top: 8px; }
      .mini-meal-actions .btn-chip { padding: 6px 8px; font-size: 11px; }

      .month-fade { animation: pageIn .3s cubic-bezier(.22,1,.36,1); }
      .month-weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 6px; }
      .month-weekday { text-align: center; font-size: 11px; color: var(--text-secondary); font-weight: 600; }
      .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .month-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 12px; font-size: 13px; font-weight: 500; transition: background .15s ease, transform .15s ease; }
      .month-cell:hover { background: var(--surface); }
      .month-cell:active { transform: scale(0.94); }
      .month-cell-today { background: var(--primary-light); color: var(--primary); font-weight: 700; }
      .month-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
      .month-dot-done { background: var(--primary); }
      .month-dot-partial { background: var(--secondary); }
      .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; font-size: 12px; color: var(--text-secondary); }
      .legend span { display: flex; align-items: center; gap: 6px; }

      /* Food */
      .search-bar { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 10px 14px; margin: 16px 0; }
      .search-input { border: none; outline: none; background: transparent; font-size: 14px; flex: 1; color: var(--text); }
      .filter-row { display: flex; flex-wrap: nowrap; gap: 8px; margin: 14px 0; overflow-x: auto; padding-bottom: 2px; -ms-overflow-style: none; scrollbar-width: none; }
      .filter-row::-webkit-scrollbar { display: none; }
      .filter-row .chip { flex-shrink: 0; }
      .food-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 4px; }
      @media (min-width: 640px) { .food-grid { grid-template-columns: 1fr 1fr; } }
      .food-disclaimer { font-size: 11.5px; line-height: 1.5; color: var(--text-secondary); margin: 0 0 14px; }
      .food-count { font-size: 12.5px; color: var(--text-secondary); font-weight: 500; margin: 4px 0 14px; }
      .food-card-name { font-family: var(--font-serif); font-weight: 600; font-size: 17px; }
      .tag-pill { font-size: 11px; background: var(--surface); color: var(--text-secondary); padding: 4px 8px; border-radius: 999px; font-weight: 500; }
      .food-meta { font-size: 12px; color: var(--text-secondary); margin-top: 12px; }
      .food-time { font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
      .food-note { font-size: 11px; color: var(--text-secondary); font-style: italic; margin-top: 4px; }
      .price-missing { font-size: 11.5px; color: var(--text-secondary); font-weight: 500; white-space: nowrap; }
      .pill-tag-warn { background: var(--secondary-tint); color: var(--primary); }
      .food-card-muted { opacity: .78; }
      .food-flag { font-size: 12px; font-weight: 600; color: var(--primary); background: var(--primary-light); border-radius: 10px; padding: 6px 10px; margin-top: 10px; }

      .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 64px 20px; color: var(--text-secondary); }
      .empty-title { font-weight: 600; color: var(--text); }
      .empty-desc { font-size: 14px; max-width: 280px; }

      /* Profile */
      .profile-header { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-bottom: 24px; }
      .avatar-wrap { position: relative; flex-shrink: 0; }
      .avatar-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid var(--card); box-shadow: 0 6px 18px rgba(24,33,43,0.14); display: block; }
      .avatar-placeholder { width: 72px; height: 72px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 600; }
      .avatar-camera-btn { position: absolute; bottom: -2px; right: -2px; width: 26px; height: 26px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; border: 2px solid var(--card); }
      .profile-header-info { flex: 1; min-width: 160px; }
      .profile-header-name { font-family: var(--font-serif); font-size: 20px; font-weight: 600; }
      .profile-header-sub { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
      .profile-header-tags { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
      .avatar-remove-link { margin-top: 8px; font-size: 12px; color: var(--text-secondary); text-decoration: underline; display: inline-block; }

      .profile-section-title { font-size: 12px; font-weight: 600; letter-spacing: .03em; color: var(--text-secondary); margin-bottom: 8px; padding-left: 4px; text-transform: uppercase; }
      .profile-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: 15px; width: 100%; transition: background .15s ease; }
      .profile-row-last { border-bottom: none; }
      .profile-row:hover { background: var(--surface); }
      .profile-row-value { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); }
      .profile-row-value span:first-child { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .swap-current { background: var(--primary-light); border-radius: 16px; padding: 12px 16px; margin-bottom: 16px; }
      .swap-current-label { font-size: 11px; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: .03em; }
      .swap-current-name { font-weight: 600; margin-top: 2px; }
      .swap-alt-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: .02em; }
      .swap-option { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); transition: border-color .15s ease, background .15s ease, transform .15s cubic-bezier(.22,1,.36,1); }
      .swap-option:hover { border-color: var(--primary); }
      .swap-option-selected { border-color: var(--primary); background: var(--primary-light); transform: scale(0.98); }

      .craving-lead { background: var(--mint-tint); border-radius: 18px; padding: 14px 16px; margin-bottom: 16px; }
      .craving-lead-title { display: block; font-weight: 600; }
      .craving-lead-sub { display: block; font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
      .craving-option { background: var(--surface); border-radius: 18px; padding: 14px 16px; }
      .craving-option-name { font-weight: 600; }
      .craving-option-source { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    `}</style>
  );
}

/* ----------------------------------------------------------------------
   UI PRIMITIVES
---------------------------------------------------------------------- */

function Chip({ label, active, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={cx("chip", active && "chip-active")}>
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function OptionCard({ label, description, icon: Icon, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx("option-card", selected && "option-card-selected")}>
      {Icon && (
        <span className="option-card-icon-wrap">
          <Icon size={18} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="option-card-label">{label}</span>
        {description && <span className="option-card-desc">{description}</span>}
      </span>
      {selected && <Check size={18} style={{ color: "var(--primary)", marginLeft: 8, flexShrink: 0 }} />}
    </button>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cx("segmented-btn", value === opt.id && "segmented-btn-active")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Shared horizontally-scrolling pill row. Caller resolves each pill's active
// state/handler so the same component works for single-select and
// multi-select filter rows alike (e.g. Food Explorer's two filter rows).
function FilterPills({ items }) {
  return (
    <div className="filter-row">
      {items.map((item) => (
        <Chip key={item.key} label={item.label} icon={item.icon} active={item.active} onClick={item.onClick} />
      ))}
    </div>
  );
}

// Shared page header: title (+ optional subtitle, or an inline action like a
// SegmentedControl) — used by Plan, Food and Profile for one consistent look.
function SectionHeader({ title, subtitle, action }) {
  return (
    <div className={cx("section-header", action && "section-header-with-action")}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("switch", checked && "switch-on")}
    >
      <span className="switch-thumb" />
    </button>
  );
}

function ProgressRing({ value, max, size = 64, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? value / max : 0;
  const offset = circumference * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: size * 0.24, fontWeight: 600, fill: "var(--text)" }}
      >
        {value}/{max}
      </text>
    </svg>
  );
}

function ValidatedNumberField({ label, value, onChange, min, max, placeholder, fieldKey, step, required }) {
  const [touched, setTouched] = useState(false);
  const rangeError = value !== "" ? getFieldError(fieldKey, value) : null;
  const requiredError = required && touched && value === "" ? "This field is required." : null;
  const error = rangeError || requiredError;
  return (
    <div>
      <label className="field-label">
        {label}
        {required && <span className="field-required-mark"> *</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        className={cx("input-field", error && "input-field-error")}
        value={value}
        min={min}
        max={max}
        step={step || 1}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!error}
        aria-required={!!required}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function TagInput({ values, onChange, placeholder }) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  };
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {values.map((v, i) => (
            <span key={i} className="chip chip-active" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${v}`}
                style={{ display: "flex" }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input-field"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel animate-sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" className="icon-btn">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function EmptyState({ title, desc, icon: Icon = Search, action }) {
  return (
    <div className="empty-state">
      <Icon size={26} style={{ color: "var(--text-secondary)" }} />
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
      {action}
    </div>
  );
}

function LoadingState({ message }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <div>{message}</div>
    </div>
  );
}

function SkeletonBlock({ w, h, style }) {
  return <div className="skeleton-block" style={{ width: w, height: h, ...style }} />;
}

function SkeletonFoodCard() {
  return (
    <div className="card food-card">
      <SkeletonBlock w="70%" h={18} />
      <SkeletonBlock w="40%" h={20} style={{ marginTop: 10, borderRadius: 999 }} />
      <SkeletonBlock w="90%" h={12} style={{ marginTop: 16 }} />
    </div>
  );
}

/* ----------------------------------------------------------------------
   NAVIGATION
---------------------------------------------------------------------- */

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "plan", label: "Plan", icon: Calendar },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "profile", label: "Profile", icon: User },
];

function MobileHeader({ onLogoClick }) {
  return (
    <div className="mobile-header">
      <button className="brand" onClick={onLogoClick}>
        <span className="brand-dot" /> DietYaar
      </button>
    </div>
  );
}

function TopNav({ screen, setScreen, onLogoClick }) {
  return (
    <div className="topnav">
      <div className="topnav-inner">
        <button className="brand" onClick={onLogoClick}>
          <span className="brand-dot" /> DietYaar
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={cx("nav-link", screen === item.id && "nav-link-active")}
              onClick={() => setScreen(item.id)}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ screen, setScreen }) {
  return (
    <div className="bottomnav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={cx("bottom-nav-item", screen === item.id && "bottom-nav-item-active")}
          onClick={() => setScreen(item.id)}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------
   LANDING
---------------------------------------------------------------------- */

function FloatingVisual() {
  const rows = [
    { label: "Breakfast", value: "Poha + Eggs" },
    { label: "Lunch", value: "Dal + Rice + Roti" },
    { label: "Snack", value: "Fruit + Curd" },
  ];
  return (
    <div className="floating-visual">
      <div className="floating-blob floating-blob-1" />
      <div className="floating-blob floating-blob-2" />
      <div className="floating-card floating-card-back">
        <Calendar size={16} style={{ color: "var(--secondary)" }} />
        <div className="floating-card-back-label">This week</div>
      </div>
      <div className="floating-card floating-card-main">
        <div className="mock-visual-header">
          <span>Today</span>
          <span className="mock-visual-dot" />
        </div>
        {rows.map((r) => (
          <div key={r.label} className="mock-visual-row">
            <div>
              <div className="mock-visual-label">{r.label}</div>
              <div className="mock-visual-value">{r.value}</div>
            </div>
            <Check size={16} style={{ color: "var(--primary)" }} />
          </div>
        ))}
      </div>
      <div className="floating-card floating-card-ring">
        <ProgressRing value={3} max={4} size={54} strokeWidth={5} />
      </div>
    </div>
  );
}

function Landing({ onStart, onDemo }) {
  const howRef = useRef(null);
  return (
    <div className="animate-page">
      <section className="landing-hero">
        <div style={{ maxWidth: 640 }}>
          <div className="eyebrow">DietYaar</div>
          <h1 className="hero-title">
            Your college food.
            <br />
            Your routine.
            <br />
            Your plan.
          </h1>
          <p className="hero-sub">
            DietYaar helps you build a realistic eating routine around your mess, canteen, cafés and college life.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onStart}>
              Build My Plan
            </button>
            <button
              className="btn-secondary"
              onClick={() => howRef.current && howRef.current.scrollIntoView({ behavior: "smooth" })}
            >
              See How It Works
            </button>
          </div>
          <button className="demo-link" onClick={onDemo}>
            Just exploring? Try a demo plan
          </button>
        </div>
        <FloatingVisual />
      </section>

      <section className="feature-grid stagger">
        {FEATURES.map((f) => (
          <div key={f.title} className="card feature-card">
            <div className="feature-icon">
              <f.icon size={20} />
            </div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </section>

      <section ref={howRef} className="how-section">
        <h2 className="section-heading">How it works</h2>
        <div className="how-grid stagger">
          {HOW_STEPS.map((s, i) => (
            <div key={s.title} className="card">
              <div className="how-number">{i + 1}</div>
              <div className="feature-title">{s.title}</div>
              <div className="feature-desc">{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button className="btn-primary" onClick={onStart}>
            Build My Plan
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>DietYaar</span>
        <span>Free, always. Made for college life.</span>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------------
   ONBOARDING STEPS
---------------------------------------------------------------------- */

function BasicInfoStep({ draft, setDraft }) {
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  return (
    <div className="step-content">
      <h2 className="step-title">Let's start with the basics</h2>
      <p className="step-sub">This helps us personalize your plan.</p>
      <label className="field-label">Name</label>
      <input className="input-field" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" />
      <div className="field-row">
        <ValidatedNumberField label="Age" value={draft.age} onChange={(v) => set("age", v)} min={13} max={100} step={1} placeholder="20" fieldKey="age" required />
        <ValidatedNumberField label="Height (cm)" value={draft.height} onChange={(v) => set("height", v)} min={100} max={250} step={1} placeholder="170" fieldKey="height" required />
        <ValidatedNumberField label="Weight (kg)" value={draft.weight} onChange={(v) => set("weight", v)} min={25} max={300} step={0.1} placeholder="60" fieldKey="weight" required />
      </div>
    </div>
  );
}

function GoalStep({ draft, setDraft }) {
  const strategy = getGoalStrategy(draft.goal);
  return (
    <div className="step-content">
      <h2 className="step-title">What's your goal?</h2>
      <p className="step-sub">We'll shape suggestions around this.</p>
      <div className="option-grid">
        {GOALS.map((g) => (
          <OptionCard key={g.id} label={g.label} icon={g.icon} selected={draft.goal === g.id} onClick={() => setDraft({ ...draft, goal: g.id })} />
        ))}
      </div>
      {strategy && <div className="strategy-hint">{strategy.focus}</div>}
    </div>
  );
}

function DietStep({ draft, setDraft }) {
  const strategy = getDietStrategy(draft.diet);
  return (
    <div className="step-content">
      <h2 className="step-title">Dietary preference</h2>
      <p className="step-sub">We'll only recommend food that fits.</p>
      <div className="option-grid">
        {DIETS.map((d) => (
          <OptionCard key={d.id} label={d.label} selected={draft.diet === d.id} onClick={() => setDraft({ ...draft, diet: d.id })} />
        ))}
      </div>
      {strategy && <div className="strategy-hint">{strategy.detail}</div>}
      <label className="field-label" style={{ marginTop: 20, display: "block" }}>
        Additional restrictions (optional)
      </label>
      <TagInput values={draft.restrictions} onChange={(v) => setDraft({ ...draft, restrictions: v })} placeholder="e.g. no onion/garlic — press Enter" />
    </div>
  );
}

function LifestyleTimesFields({ draft, setDraft }) {
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  return (
    <>
      <div className="field-row-2" style={{ marginTop: 20 }}>
        <div>
          <label className="field-label">Wake time</label>
          <input type="time" className="input-field" value={draft.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Sleep time</label>
          <input type="time" className="input-field" value={draft.sleepTime} onChange={(e) => set("sleepTime", e.target.value)} />
        </div>
      </div>
      <div className="field-row-2" style={{ marginTop: 12 }}>
        <div>
          <label className="field-label">College start</label>
          <input type="time" className="input-field" value={draft.collegeStart} onChange={(e) => set("collegeStart", e.target.value)} />
        </div>
        <div>
          <label className="field-label">College end</label>
          <input type="time" className="input-field" value={draft.collegeEnd} onChange={(e) => set("collegeEnd", e.target.value)} />
        </div>
      </div>
    </>
  );
}

function LifestyleStep({ draft, setDraft }) {
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  return (
    <div className="step-content">
      <h2 className="step-title">Your lifestyle</h2>
      <p className="step-sub">Helps us fit meals around your day.</p>
      <label className="field-label">Activity level</label>
      <div className="option-grid">
        {ACTIVITY_LEVELS.map((a) => (
          <OptionCard key={a.id} label={a.label} selected={draft.activity === a.id} onClick={() => set("activity", a.id)} />
        ))}
      </div>
      <label className="field-label" style={{ marginTop: 20, display: "block" }}>
        Exercise frequency
      </label>
      <div className="option-grid">
        {EXERCISE_FREQS.map((a) => (
          <OptionCard key={a.id} label={a.label} selected={draft.exercise === a.id} onClick={() => set("exercise", a.id)} />
        ))}
      </div>
      <LifestyleTimesFields draft={draft} setDraft={setDraft} />
    </div>
  );
}

function FoodPrefStep({ draft, setDraft }) {
  return (
    <div className="step-content">
      <h2 className="step-title">Food preferences</h2>
      <p className="step-sub">Optional, but makes recommendations sharper.</p>
      <label className="field-label">Foods you like</label>
      <TagInput values={draft.likes} onChange={(v) => setDraft({ ...draft, likes: v })} placeholder="e.g. Paneer — press Enter" />
      <label className="field-label" style={{ marginTop: 16, display: "block" }}>
        Foods you dislike
      </label>
      <TagInput values={draft.dislikes} onChange={(v) => setDraft({ ...draft, dislikes: v })} placeholder="e.g. Noodles — press Enter" />
      <label className="field-label" style={{ marginTop: 16, display: "block" }}>
        Ingredients to avoid
      </label>
      <TagInput values={draft.avoid} onChange={(v) => setDraft({ ...draft, avoid: v })} placeholder="e.g. Mushroom — press Enter" />
      <label className="field-label" style={{ marginTop: 16, display: "block" }}>
        Allergies / intolerances
      </label>
      <TagInput values={draft.allergies} onChange={(v) => setDraft({ ...draft, allergies: v })} placeholder="e.g. Peanuts — press Enter" />
      {draft.allergies.length > 0 && (
        <div className="allergy-box">
          <p>
            Most campus menu entries don't list ingredients or allergens, so DietYaar can't confirm any of them is free of {draft.allergies.join(", ")}. By default, only items whose
            ingredients can be confirmed are suggested — which may mean few or none.
          </p>
          <p className="allergy-fine">DietYaar will not recommend an item when it cannot verify the ingredients against your listed allergies. Please confirm ingredients and cross-contact risks directly with the vendor; never rely on the app alone for a serious allergy.</p>
        </div>
      )}
    </div>
  );
}

function SourcesStep({ draft, setDraft }) {
  const toggle = (id) => {
    const has = draft.sources.includes(id);
    setDraft({ ...draft, sources: has ? draft.sources.filter((s) => s !== id) : [...draft.sources, id] });
  };
  return (
    <div className="step-content">
      <h2 className="step-title">Where do you eat?</h2>
      <p className="step-sub">Pick every source you use.</p>
      <div className="option-grid">
        {SOURCE_OPTIONS.map((s) => (
          <OptionCard
            key={s.id}
            label={s.label}
            icon={s.icon}
            description={getSourceStrategy(s.id) ? getSourceStrategy(s.id).detail.split(" — ")[0] : undefined}
            selected={draft.sources.includes(s.id)}
            onClick={() => toggle(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

const TOTAL_STEPS = 6;

function Onboarding({ step, setStep, draft, setDraft, onFinish, isGenerating }) {
  const canNext = validateStep(step, draft);
  return (
    <div className="onboarding-wrap animate-page">
      <div className="onboarding-brand">
        <span className="brand-dot" /> DietYaar
      </div>
      <div className="card onboarding-panel">
        <div className="onboarding-progress">
          <div className="onboarding-progress-fill" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
        <div className="onboarding-step-label">
          Step {step + 1} of {TOTAL_STEPS}
        </div>

      {isGenerating ? (
        <LoadingState message="Building your plan..." />
      ) : (
        <>
          <div>
            {step === 0 && <BasicInfoStep draft={draft} setDraft={setDraft} />}
            {step === 1 && <GoalStep draft={draft} setDraft={setDraft} />}
            {step === 2 && <DietStep draft={draft} setDraft={setDraft} />}
            {step === 3 && <LifestyleStep draft={draft} setDraft={setDraft} />}
            {step === 4 && <FoodPrefStep draft={draft} setDraft={setDraft} />}
            {step === 5 && <SourcesStep draft={draft} setDraft={setDraft} />}
          </div>
          <div className="onboarding-nav">
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < TOTAL_STEPS - 1 && (
              <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next
              </button>
            )}
            {step === TOTAL_STEPS - 1 && (
              <button className="btn-primary" disabled={!canNext} onClick={onFinish}>
                Build My Plan
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
   BMI + WEEKLY PROGRESS UI
---------------------------------------------------------------------- */

// Plain SVG sparkline — no charting library, consistent with ProgressRing.
function WeightHistoryChart({ history, dataKey }) {
  const values = history.map((h) => h[dataKey]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (values.length < 2) {
    return <div className="chart-empty">Check in a couple more times to see a trend here.</div>;
  }
  const width = 280;
  const height = 76;
  const padding = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * (width - padding * 2),
    y: height - padding - ((v - min) / range) * (height - padding * 2),
  }));
  const points = coords.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--primary)" />
      ))}
    </svg>
  );
}

function WeightCheckInSheet({ open, onClose, profile, onSave }) {
  const [weight, setWeight] = useState("");
  useEffect(() => {
    if (open) setWeight(profile.weight || "");
  }, [open, profile.weight]);
  const error = weight !== "" ? getFieldError("weight", weight) : "This field is required.";
  return (
    <BottomSheet open={open} onClose={onClose} title="Weekly check-in">
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
        A quick weekly weigh-in helps you see trends over time — no pressure, just data.
      </p>
      <ValidatedNumberField label="Current weight (kg)" value={weight} onChange={setWeight} min={25} max={300} step={0.1} placeholder="60" fieldKey="weight" />
      <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={!!error} onClick={() => onSave(weight)}>
        Save check-in
      </button>
    </BottomSheet>
  );
}

function ProgressSheet({ open, onClose, profile, weightHistory, onOpenCheckIn }) {
  const sorted = useMemo(() => [...weightHistory].sort((a, b) => new Date(a.date) - new Date(b.date)), [weightHistory]);
  const current = sorted[sorted.length - 1] || null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const weightChange = current && previous && typeof current.weight === "number" && typeof previous.weight === "number" ? current.weight - previous.weight : null;
  const bmiChange = current && previous && typeof current.bmi === "number" && typeof previous.bmi === "number" ? current.bmi - previous.bmi : null;
  const sinceLast = current ? daysSince(current.date) : null;
  const checkInDue = !current || (sinceLast !== null && sinceLast >= 7);

  return (
    <BottomSheet open={open} onClose={onClose} title="Your progress">
      {checkInDue && (
        <div className="checkin-banner" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{current ? "Weekly check-in" : "Start your weekly progress"}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {current ? "Time to update your progress." : "Log your weight to start tracking trends."}
            </div>
          </div>
          <button className="btn-secondary" onClick={onOpenCheckIn}>
            Update weight
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState title="No check-ins yet" desc="Log your weight to start tracking your trend over time." icon={TrendingUp} />
      ) : (
        <>
          <div className="progress-stats-grid">
            <div className="progress-stat">
              <div className="progress-stat-label">Current weight</div>
              <div className="progress-stat-value">{typeof current.weight === "number" ? `${current.weight} kg` : "—"}</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-label">Previous weight</div>
              <div className="progress-stat-value">{previous && typeof previous.weight === "number" ? `${previous.weight} kg` : "—"}</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-label">Current BMI</div>
              <div className="progress-stat-value">{typeof current.bmi === "number" ? current.bmi.toFixed(1) : "—"}</div>
              {typeof current.bmi === "number" && getBMICategory(current.bmi, profile.age) && (
                <div className="progress-stat-note">{getBMICategory(current.bmi, profile.age)}</div>
              )}
            </div>
            <div className="progress-stat">
              <div className="progress-stat-label">Previous BMI</div>
              <div className="progress-stat-value">{previous && typeof previous.bmi === "number" ? previous.bmi.toFixed(1) : "—"}</div>
            </div>
          </div>

          {(weightChange !== null || bmiChange !== null) && (
            <div className="progress-change">
              {weightChange !== null && (weightChange === 0 ? "No change in weight" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`)}
              {weightChange !== null && bmiChange !== null && " · "}
              {bmiChange !== null && `BMI ${bmiChange > 0 ? "+" : ""}${bmiChange.toFixed(1)}`}
              {" since last check-in"}
            </div>
          )}

          <div className="field-label" style={{ marginTop: 20 }}>
            Weight trend (kg)
          </div>
          <WeightHistoryChart history={sorted} dataKey="weight" />

          <div className="field-label" style={{ marginTop: 20 }}>
            BMI trend
          </div>
          <WeightHistoryChart history={sorted} dataKey="bmi" />

        </>
      )}

      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 16, lineHeight: 1.5 }}>
        BMI is a simple height-to-weight ratio. It doesn't measure fitness, muscle or overall health, and DietYaar never uses it to restrict your meals or push weight loss.
      </p>
      {profile.age && Number(profile.age) < 18 && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
          BMI is shown as a number only — under-18 BMI needs age/sex-specific growth charts to interpret, so we don't apply adult categories here.
        </p>
      )}
    </BottomSheet>
  );
}

function BudgetSheet({ open, onClose, value, onChange }) {
  const options = [null, 50, 75, 100, 150];
  return (
    <BottomSheet open={open} onClose={onClose} title="Budget mode">
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
        Nudges recommendations toward meals at or under this price — it's a preference, not a hard limit.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <Chip
            key={opt === null ? "none" : opt}
            label={opt === null ? "No limit" : `≤ ${formatINR(opt)}`}
            active={value === opt}
            onClick={() => {
              onChange(opt);
              onClose();
            }}
          />
        ))}
      </div>
    </BottomSheet>
  );
}

/* ----------------------------------------------------------------------
   RECOMMENDATION CARD — used for the 3 "right now" picks on Home.
   Card 1 (featured) gets the filled-blue treatment + full "why this?";
   cards 2–3 stay white/compact with the shorter reason line. Same data,
   same getRecommendedMeals() ranking — only the presentation differs.
---------------------------------------------------------------------- */

function RecommendationCard({ combo, profile, featured, onEat }) {
  const location = combo.locationId ? getFoodLocation(combo.locationId) : null;
  const parcelLabel = getParcelChargeLabel(location);
  const visibleTags = combo.tags.filter((t) => TAG_LABELS[t]);
  const categoryLabel = combo.category ? combo.category.replace(/-/g, " ") : null;

  return (
    <div className={cx("card rec-card-v2", featured && "rec-card-featured")}>
      <div className="rec-card-top">
        <div className="rec-card-name">{combo.items.join(" + ")}</div>
        {formatPrice(combo) && <div className="rec-card-price">{formatPrice(combo)}</div>}
      </div>
      <div className="rec-card-location">
        <MapPin size={12} /> {location ? location.name : SOURCE_LABELS[combo.source]}
      </div>
      <div className="rec-card-pills">
        {categoryLabel && <span className="pill-tag">{categoryLabel}</span>}
        <span className="pill-tag">{DIET_CLASS_LABELS[getDietClass(combo)]}</span>
        {visibleTags.map((t) => (
          <span key={t} className="pill-tag">
            {TAG_LABELS[t]}
          </span>
        ))}
      </div>

      {featured ? (
        <div className="rec-card-why">
          <div className="rec-card-why-label">Why this?</div>
          <div className="rec-card-why-text">{getRecommendationReason(combo, profile, {})}</div>
        </div>
      ) : (
        <div className="rec-card-reason">{getComboReason(combo, profile)}</div>
      )}

      {(combo.note || parcelLabel) && <div className="rec-card-note">{[combo.note, parcelLabel].filter(Boolean).join(" · ")}</div>}
      <div className="rec-card-note">{getUncertaintyNotes(combo, profile).join(" · ")}</div>

      <button className={cx("rec-card-eat", featured && "rec-card-eat-featured")} onClick={() => onEat(combo)}>
        <Check size={14} /> Eat this
      </button>
    </div>
  );
}

function SkeletonRecCard({ featured }) {
  return (
    <div className={cx("card rec-card-v2", featured && "rec-card-featured")}>
      <SkeletonBlock w="60%" h={20} />
      <SkeletonBlock w="40%" h={14} style={{ marginTop: 10 }} />
      <SkeletonBlock w="90%" h={36} style={{ marginTop: 14, borderRadius: 12 }} />
    </div>
  );
}

function StatCard({ label, value, sub, foot, onClick }) {
  const content = (
    <>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
      {foot && <div className="stat-card-foot">{foot}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="card card-hover stat-card" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="card stat-card">{content}</div>;
}

/* ----------------------------------------------------------------------
   DASHBOARD (Home)
---------------------------------------------------------------------- */

function Dashboard({
  profile,
  completed,
  todayIndex,
  mealContext,
  rightNowItems,
  rightNowReasonContext,
  onEatThis,
  onShowSomethingElse,
  onOpenCraving,
  weightHistory,
  onOpenProgress,
  onOpenBudget,
  emptyInfo,
  onResetSkipped,
  widenSources,
  onToggleWiden,
  onGoToProfile,
  preferredMissing,
  loading,
}) {
  const greeting = getGreeting(new Date().getHours());
  const timeLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const doneCount = MEAL_TYPES.filter((mt) => completed[`${todayIndex}-${mt}`]).length;
  const bmi = calculateBMI(profile.weight, profile.height);
  const bmiCategory = getBMICategory(bmi, profile.age);
  const lastWeightEntry = weightHistory.length ? [...weightHistory].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-1)[0] : null;

  const featured = rightNowItems[0] || null;
  const secondary = rightNowItems.slice(1, 3);

  return (
    <div className="animate-page">
      <div className="dash-header">
        <h1 className="dash-greeting">
          {greeting}
          {profile.name ? `,\u00A0${profile.name}` : ""}.
        </h1>
      </div>

      <section className="right-now-section">
        <h2 className="right-now-title">What should you eat right now?</h2>
        <div className="time-pill">
          <Sparkles size={12} /> It's {timeLabel} · {mealContext.isBetween ? "Between meals" : `${mealContext.label} time`}
        </div>
        <p className="right-now-lead">Personalised for your goal, diet &amp; the campus around you.</p>

        {widenSources && (
          <div className="notice">
            Including food places outside the sources you selected.
            <button type="button" className="btn-tertiary" onClick={onToggleWiden}>
              Turn off
            </button>
          </div>
        )}
        {!loading && preferredMissing && (
          <div className="notice">None of your favourite spots has a suitable option for this meal, so these come from your other selected places.</div>
        )}

        {loading ? (
          <div className="recs-grid">
            <SkeletonRecCard featured />
            <div className="recs-secondary-row">
              <SkeletonRecCard />
              <SkeletonRecCard />
            </div>
          </div>
        ) : !featured ? (
          <div className="card">
            <EmptyState
              title={emptyInfo && emptyInfo.kind === "exhausted" ? "You've seen them all" : "No suitable option found"}
              desc={emptyInfo ? emptyInfo.message : "Nothing matches your settings for this meal."}
              icon={Sparkles}
              action={
                <div className="empty-actions">
                  {emptyInfo && emptyInfo.kind === "exhausted" && (
                    <button type="button" className="btn-secondary" onClick={onResetSkipped}>
                      Show these options again
                    </button>
                  )}
                  {emptyInfo && emptyInfo.kind === "budget" && (
                    <button type="button" className="btn-secondary" onClick={onOpenBudget}>
                      Change budget
                    </button>
                  )}
                  {emptyInfo && emptyInfo.canWiden && (
                    <button type="button" className="btn-secondary" onClick={onToggleWiden}>
                      Include other food places
                    </button>
                  )}
                  <button type="button" className="btn-tertiary" onClick={onGoToProfile}>
                    Review my preferences
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="recs-grid stagger">
              <RecommendationCard combo={featured} profile={profile} featured onEat={onEatThis} />
              {secondary.length > 0 && (
                <div className="recs-secondary-row">
                  {secondary.map((c) => (
                    <RecommendationCard key={c.id} combo={c} profile={profile} onEat={onEatThis} />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-tertiary show-else-btn"
              onClick={() => onShowSomethingElse(rightNowItems.map((c) => c.id))}
            >
              <RefreshCw size={14} /> Show me something else
            </button>
          </>
        )}
      </section>

      <div className="stats-row stagger">
        <StatCard label="Meals today" value={`${doneCount} / 4`} sub="Breakfast · Lunch · Snack · Dinner" />
        <StatCard
          label="Your BMI"
          value={bmi !== null ? bmi.toFixed(1) : "—"}
          sub={bmi !== null ? bmiCategory || "Number only — under 18" : "Add height & weight"}
          foot={lastWeightEntry ? `Updated ${formatShortDate(new Date(lastWeightEntry.date))}` : null}
          onClick={onOpenProgress}
        />
        <StatCard
          label="Budget mode"
          value={typeof profile.budgetLimit === "number" ? `≤ ${formatINR(profile.budgetLimit)}` : "No limit"}
          sub="Change budget →"
          onClick={onOpenBudget}
        />
      </div>

      <div className="teaser-row">
        <button type="button" className="card card-hover teaser-card" onClick={onOpenCraving}>
          <div className="teaser-label">Craving something?</div>
          <div className="teaser-title">Have it if you want.</div>
          <div className="teaser-sub">Let's make the rest of the day's choices easier.</div>
        </button>
        <button type="button" className="card card-hover teaser-card" onClick={onOpenProgress}>
          <div className="teaser-label">Weekly progress</div>
          <div className="teaser-title">
            {weightHistory.length === 0 ? "Log a couple of check-ins to see your trend." : "See how you're tracking."}
          </div>
        </button>
      </div>
    </div>
  );
}


/* ----------------------------------------------------------------------
   PLAN — DAILY (today's 4 meals, with an explicit Missed action)
---------------------------------------------------------------------- */

function DailyPlanner({ profile, weekPlan, completed, missed, extras, todayIndex, onSwap, onToggleDone, onMarkMissed, onAddExtra }) {
  const todayPlan = weekPlan[todayIndex] || {};
  return (
    <div className="meal-grid stagger">
      {MEAL_TYPES.map((mt) => {
        const comboId = todayPlan[mt];
        const combo = getComboById(comboId);
        const key = `${todayIndex}-${mt}`;
        const done = !!completed[key];
        const isMissed = !!missed[key];
        const extraList = extras[key] || [];
        const isJunk = combo && combo.tags.includes("junk");
        return (
          <div key={mt} className={cx("card card-hover meal-card", done && "meal-card-done", isMissed && "meal-card-missed")}>
            <div className="meal-card-top">
              <span className="meal-type-label">{MEAL_LABELS[mt]}</span>
              <span className="source-tag">{combo ? getSourceTagText(combo) : ""}</span>
            </div>
            <div className="meal-items">{combo ? comboDisplay(combo, extraList) : "No suitable option found"}</div>
            {!combo && <div className="food-note">Nothing on record fits your diet, allergies and selected places for this meal. Try Swap, or review your preferences in Profile.</div>}
            {combo && <div className="balance-pill">{comboBalanceLabel(combo)}</div>}
            <div className="meal-card-actions">
              <button className={cx("btn-chip", done && "btn-chip-done")} disabled={!combo} onClick={() => onToggleDone(todayIndex, mt)}>
                <Check size={13} /> {done ? "Done" : "Ate this"}
              </button>
              <button className="btn-chip" onClick={() => onSwap(todayIndex, mt)}>
                <RefreshCw size={13} /> Swap
              </button>
              <button className={cx("btn-chip", isMissed && "btn-chip-missed")} disabled={!combo} onClick={() => onMarkMissed(todayIndex, mt)}>
                <X size={13} /> Missed
              </button>
            </div>
            {isJunk && (
              <div className="junk-note">
                <div className="junk-note-title">Having {combo.items[0]}?</div>
                <div className="junk-note-text">It's okay to have it sometimes.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {JUNK_BOOSTS.filter((b) => !extraList.includes(b))
                    .slice(0, 4)
                    .map((b) => (
                      <Chip key={b} label={`Add ${b}`} onClick={() => onAddExtra(todayIndex, mt, b)} />
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------
   PLAN — WEEKLY
---------------------------------------------------------------------- */

function MiniMealCard({ mealType, combo, done, extraList, profile, onSwap, onToggleDone }) {
  const aligned = !!(profile && combo && isGoalAligned(combo, profile));
  return (
    <div className="mini-meal">
      <div className="mini-meal-top">
        <span className="meal-type-label-sm">{MEAL_LABELS[mealType]}</span>
        <span className="mini-meal-badges">
          {aligned && (
            <span className="align-badge" title="Matches your goal">
              <Check size={10} />
            </span>
          )}
          {combo && combo.tags.includes("junk") && <span className="treat-badge">Treat</span>}
        </span>
      </div>
      <div className="mini-meal-items">{combo ? comboDisplay(combo, extraList) : "No suitable option found"}</div>
      {combo && <div className="mini-meal-source">{getSourceTagText(combo)}</div>}
      <div className="mini-meal-actions">
        <button className="btn-chip" onClick={onSwap}>
          <RefreshCw size={12} /> Swap
        </button>
        <button className={cx("btn-chip", done && "btn-chip-done")} disabled={!combo} aria-label={done ? "Mark as not eaten" : "Mark as eaten"} onClick={onToggleDone}>
          <Check size={12} />
        </button>
      </div>
    </div>
  );
}

function WeeklyPlanner({ profile, weekPlan, completed, extras, weekDates, todayIndex, onSwap, onToggleDone, onRegenerateDay }) {
  const [expanded, setExpanded] = useState(() => new Set([todayIndex]));
  const toggle = (i) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {DAY_NAMES.map((name, i) => {
        const isToday = i === todayIndex;
        const dayPlan = weekPlan[i] || {};
        const doneCount = MEAL_TYPES.filter((mt) => completed[`${i}-${mt}`]).length;
        const isOpen = expanded.has(i);
        return (
          <div key={i} className={cx("card day-card", isToday && "day-card-today")}>
            <button className="day-card-header" onClick={() => toggle(i)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="day-badge">{name.slice(0, 3)}</div>
                <div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center" }}>
                    {name}
                    {isToday && <span className="today-tag">Today</span>}
                  </div>
                  <div className="day-sub">
                    {formatShortDate(weekDates[i])} · {doneCount}/4 meals done
                  </div>
                </div>
              </div>
              <ChevronRight size={18} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s cubic-bezier(.22,1,.36,1)" }} />
            </button>
            {isOpen && (
              <div className="day-body">
                <div className="day-meals-grid">
                  {MEAL_TYPES.map((mt) => {
                    const combo = getComboById(dayPlan[mt]);
                    const key = `${i}-${mt}`;
                    const done = !!completed[key];
                    return (
                      <MiniMealCard
                        key={mt}
                        mealType={mt}
                        combo={combo}
                        done={done}
                        extraList={extras[key]}
                        profile={profile}
                        onSwap={() => onSwap(i, mt)}
                        onToggleDone={() => onToggleDone(i, mt)}
                      />
                    );
                  })}
                </div>
                <button className="btn-secondary" style={{ marginTop: 14, width: "100%" }} onClick={() => onRegenerateDay(i)}>
                  <RefreshCw size={14} /> Regenerate day
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------
   PLAN — MONTHLY
---------------------------------------------------------------------- */

function MonthlyPlanner({ monthCursor, setMonthCursor, onSelectDate, mealHistory }) {
  const cells = buildMonthMatrix(monthCursor);
  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div>
      <div className="card month-fade" key={monthCursor.getTime()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button className="icon-btn" onClick={() => setMonthCursor(addMonths(monthCursor, -1))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontWeight: 600 }}>{monthLabel}</div>
          <button className="icon-btn" onClick={() => setMonthCursor(addMonths(monthCursor, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="month-weekday-row">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="month-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="month-grid">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={idx} />;
            const progress = getDayProgress(cell, mealHistory);
            const isToday = isSameDay(cell, new Date());
            return (
              <button key={idx} className={cx("month-cell", isToday && "month-cell-today")} onClick={() => onSelectDate(cell)}>
                <span>{cell.getDate()}</span>
                <span
                  className={cx(
                    "month-dot",
                    progress.kind === "done" && "month-dot-done",
                    progress.kind === "partial" && "month-dot-partial"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="legend">
        <span>
          <span className="month-dot month-dot-done" /> All 4 meals logged
        </span>
        <span>
          <span className="month-dot month-dot-partial" /> Some meals logged
        </span>
        <span>
          <span className="month-dot" /> Nothing logged
        </span>
      </div>
    </div>
  );
}

function PlanScreen({
  profile,
  weekPlan,
  completed,
  missed,
  extras,
  weekDates,
  todayIndex,
  view,
  setView,
  onSwap,
  onToggleDone,
  onMarkMissed,
  onAddExtra,
  onRegenerateDay,
  monthCursor,
  setMonthCursor,
  onSelectDate,
  mealHistory,
}) {
  return (
    <div className="animate-page" style={{ paddingTop: 24 }}>
      <SectionHeader
        title="Your plan"
        action={
          <SegmentedControl
            options={[
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {view === "daily" && (
        <DailyPlanner
          profile={profile}
          weekPlan={weekPlan}
          completed={completed}
          missed={missed}
          extras={extras}
          todayIndex={todayIndex}
          onSwap={onSwap}
          onToggleDone={onToggleDone}
          onMarkMissed={onMarkMissed}
          onAddExtra={onAddExtra}
        />
      )}
      {view === "weekly" && (
        <WeeklyPlanner
          profile={profile}
          weekPlan={weekPlan}
          completed={completed}
          extras={extras}
          weekDates={weekDates}
          todayIndex={todayIndex}
          onSwap={onSwap}
          onToggleDone={onToggleDone}
          onRegenerateDay={onRegenerateDay}
        />
      )}
      {view === "monthly" && <MonthlyPlanner monthCursor={monthCursor} setMonthCursor={setMonthCursor} onSelectDate={onSelectDate} mealHistory={mealHistory} />}
    </div>
  );
}

/* ----------------------------------------------------------------------
   FOOD EXPLORER
---------------------------------------------------------------------- */

function FoodCard({ combo, profile }) {
  // Estimated figures are never shown as facts: only items explicitly marked confirmed.
  const hasNutrition = combo.nutritionConfirmed === true && typeof combo.calories === "number" && typeof combo.protein === "number";
  const location = combo.locationId ? getFoodLocation(combo.locationId) : null;
  const parcelLabel = location ? getParcelChargeLabel(location) : null;
  const categoryLabel = combo.category ? combo.category.replace(/-/g, " ") : null;
  const price = formatPrice(combo);
  const eligibility = getEligibility(combo, profile || {});
  const notes = getUncertaintyNotes(combo, profile).filter((n) => n !== "Price not confirmed");
  return (
    <div className={cx("card card-hover food-card", !eligibility.eligible && "food-card-muted")}>
      <div className="rec-card-top">
        <div className="food-card-name">{combo.items.join(" + ")}</div>
        {price ? <div className="rec-card-price">{price}</div> : <div className="price-missing">Price not confirmed</div>}
      </div>
      <div className="rec-card-location">
        <MapPin size={12} /> {getSourceDisplayLabel(combo)}
      </div>
      {combo.note && <div className="food-note">{combo.note}</div>}
      {parcelLabel && <div className="food-note">{parcelLabel}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {categoryLabel && <span className="pill-tag">{categoryLabel}</span>}
        <span className={cx("pill-tag", getDietClass(combo) === "unknown" && "pill-tag-warn")}>{DIET_CLASS_LABELS[getDietClass(combo)]}</span>
        {combo.tags.map((t) => (
          <span key={t} className="pill-tag">
            {TAG_LABELS[t] || t}
          </span>
        ))}
      </div>
      {!eligibility.eligible && <div className="food-flag">Not suitable for your profile: {describeIneligibility(eligibility.reasons)}</div>}
      {hasNutrition && (
        <div className="food-meta">
          {combo.calories} kcal · {combo.protein}g protein
        </div>
      )}
      <div className="food-time">
        {combo.locationId
          ? `Suits ${combo.mealTypes.map((mt) => MEAL_LABELS[mt].toLowerCase()).join(" · ")}`
          : combo.mealTypes.map((mt) => MEAL_TIME_WINDOWS[mt]).join(" · ")}
      </div>
      {notes.map((n) => (
        <div key={n} className="food-note">
          {n}
        </div>
      ))}
    </div>
  );
}

const DIET_FILTERS = [
  { id: "all", label: "All foods" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "non-vegetarian", label: "Non-vegetarian" },
  { id: "vegan", label: "Vegan" },
];

function titleCase(str) {
  return String(str).replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function FoodScreen({ profile }) {
  const [mealFilter, setMealFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toggles, setToggles] = useState({ protein: false, quick: false, budget: false });
  const [dietFilter, setDietFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, [locationFilter]);

  const toggleFilter = (k) => setToggles((prev) => ({ ...prev, [k]: !prev[k] }));

  // Categories on offer follow the selected location, most common first.
  const categories = useMemo(() => {
    const counts = {};
    MEAL_COMBOS.filter((c) => locationFilter === "all" || c.locationId === locationFilter).forEach((c) => {
      if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [locationFilter]);

  useEffect(() => {
    if (categoryFilter !== "all" && categories.indexOf(categoryFilter) < 0) setCategoryFilter("all");
  }, [categories, categoryFilter]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MEAL_COMBOS.filter((c) => locationFilter === "all" || c.locationId === locationFilter)
      .filter((c) => mealFilter === "all" || c.mealTypes.includes(mealFilter))
      .filter((c) => dietFilter === "all" || isMealAllowedForDiet(c, dietFilter)) // same rule as recommendations/plans/swaps
      .filter((c) => categoryFilter === "all" || c.category === categoryFilter)
      .filter((c) => !toggles.protein || c.tags.includes("protein"))
      .filter((c) => !toggles.quick || c.tags.includes("quick"))
      .filter((c) => !toggles.budget || c.tags.includes("budget"))
      .filter((c) => !q || c.items.some((it) => it.toLowerCase().includes(q)));
  }, [locationFilter, mealFilter, dietFilter, categoryFilter, toggles, query]);

  const selectedLocation = locationFilter !== "all" ? getFoodLocation(locationFilter) : null;
  const anyFilterActive =
    mealFilter !== "all" || dietFilter !== "all" || categoryFilter !== "all" || locationFilter !== "all" || query.trim() !== "" || toggles.protein || toggles.quick || toggles.budget;
  const clearFilters = () => {
    setMealFilter("all");
    setDietFilter("all");
    setCategoryFilter("all");
    setLocationFilter("all");
    setQuery("");
    setToggles({ protein: false, quick: false, budget: false });
  };

  const mealTypePills = ["all", "breakfast", "lunch", "snack", "dinner"].map((mt) => ({
    key: mt,
    label: mt === "all" ? "All" : MEAL_LABELS[mt],
    active: mealFilter === mt,
    onClick: () => setMealFilter(mt),
  }));
  const qualityPills = [
    { key: "protein", label: "Protein-rich", icon: Dumbbell, active: toggles.protein, onClick: () => toggleFilter("protein") },
    { key: "quick", label: "Quick", icon: Zap, active: toggles.quick, onClick: () => toggleFilter("quick") },
    { key: "budget", label: "Budget-friendly", icon: Wallet, active: toggles.budget, onClick: () => toggleFilter("budget") },
  ];
  const dietPills = DIET_FILTERS.map((d) => ({ key: d.id, label: d.label, icon: d.id === "vegetarian" ? Leaf : undefined, active: dietFilter === d.id, onClick: () => setDietFilter(d.id) }));
  const categoryPills = [
    { key: "all", label: "All categories", active: categoryFilter === "all", onClick: () => setCategoryFilter("all") },
    ...categories.map((c) => ({ key: c, label: titleCase(c), active: categoryFilter === c, onClick: () => setCategoryFilter(c) })),
  ];
  const locationPills = [
    { key: "all", label: "All locations", active: locationFilter === "all", onClick: () => setLocationFilter("all") },
    ...FOOD_LOCATIONS.filter((l) => l.active).map((loc) => ({
      key: loc.id,
      label: loc.name,
      icon: MapPin,
      active: locationFilter === loc.id,
      onClick: () => setLocationFilter(loc.id),
    })),
  ];

  return (
    <div className="animate-page" style={{ paddingTop: 24 }}>
      <SectionHeader title="What's available?" subtitle="Browse recorded campus menus and everyday options." />

      <div className="search-bar">
        <Search size={16} style={{ color: "var(--text-secondary)" }} />
        <input className="search-input" aria-label="Search food by name" placeholder="Search food, e.g. paneer" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <FilterPills items={[...mealTypePills, ...qualityPills]} />
      <FilterPills items={dietPills} />
      {categories.length > 0 && <FilterPills items={categoryPills} />}
      <FilterPills items={locationPills} />

      <div className="food-count">
        {items.length} item{items.length === 1 ? "" : "s"}
        {selectedLocation ? ` at ${selectedLocation.name}` : ""}
        {selectedLocation && getParcelChargeLabel(selectedLocation) && ` · ${getParcelChargeLabel(selectedLocation)}`}
        {dietFilter !== "all" && ` · suitable for ${DIET_FILTERS.find((d) => d.id === dietFilter).label.toLowerCase()} eaters`}
      </div>
      <p className="food-disclaimer">
        These are recorded menu items and prices, not live availability. Ingredients and nutrition aren't confirmed, and tags like Protein-rich describe the type of dish, not measured values. Items with unconfirmed ingredients are never counted as vegan or vegetarian.
      </p>

      {loading ? (
        <div className="food-grid">
          <SkeletonFoodCard />
          <SkeletonFoodCard />
          <SkeletonFoodCard />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No matching food"
          desc={
            dietFilter !== "all"
              ? `Nothing here is confirmed as suitable for ${DIET_FILTERS.find((d) => d.id === dietFilter).label.toLowerCase()} eaters with these filters. Try another location or loosen a filter.`
              : "Try removing a filter or searching for something else."
          }
          action={
            anyFilterActive ? (
              <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={clearFilters}>
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <div className="food-grid stagger">
          {items.map((c) => (
            <FoodCard key={c.id} combo={c} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------
   PROFILE
---------------------------------------------------------------------- */

function ProfileHeader({ profile, photo, onUploadClick, onRemove, photoLoading }) {
  const strategy = getGoalStrategy(profile.goal);
  return (
    <div className="card profile-header">
      <div className="avatar-wrap">
        {photo ? (
          <img src={photo} alt="Profile" className="avatar-img" />
        ) : (
          <div className="avatar-placeholder">{(profile.name || "D").charAt(0).toUpperCase()}</div>
        )}
        <button type="button" className="avatar-camera-btn" onClick={onUploadClick} aria-label="Change photo" disabled={photoLoading}>
          <Camera size={13} />
        </button>
      </div>
      <div className="profile-header-info">
        <div className="profile-header-name">{profile.name || "Your name"}</div>
        <div className="profile-header-sub">{strategy ? strategy.focus : "Set up your goal to see a plan focus here."}</div>
        <div className="profile-header-tags">
          {profile.diet && <span className="tag-pill">{findLabel(DIETS, profile.diet, profile.diet)}</span>}
          {profile.goal && <span className="tag-pill">{findLabel(GOALS, profile.goal, profile.goal)}</span>}
        </div>
        {photo && (
          <button type="button" className="avatar-remove-link" onClick={onRemove}>
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="profile-section-title">{title}</div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function ProfileRow({ label, value, onClick, last, danger }) {
  return (
    <button type="button" onClick={onClick} className={cx("profile-row", last && "profile-row-last")} disabled={!onClick}>
      <span style={danger ? { color: "var(--error)", fontWeight: 500 } : undefined}>{label}</span>
      <span className="profile-row-value">
        {value && <span>{value}</span>}
        {onClick && !danger && <ChevronRight size={16} />}
      </span>
    </button>
  );
}

function ProfileScreen({ profile, setProfile, notifications, setNotifications, photo, photoLoading, onPhotoUpload, onPhotoRemove, onResetAll, goToPlan }) {
  const [editSheet, setEditSheet] = useState(null);
  const fileInputRef = useRef(null);
  const personalValid = isBasicInfoValid(profile);

  return (
    <div className="animate-page" style={{ paddingTop: 24, paddingBottom: 20 }}>
      <SectionHeader title="Profile" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) onPhotoUpload(file);
          e.target.value = "";
        }}
      />

      <ProfileHeader
        profile={profile}
        photo={photo}
        photoLoading={photoLoading}
        onUploadClick={() => fileInputRef.current && fileInputRef.current.click()}
        onRemove={onPhotoRemove}
      />

      <ProfileSection title="Personal">
        <ProfileRow label="Name" value={profile.name || "—"} onClick={() => setEditSheet("personal")} />
        <ProfileRow label="Age" value={profile.age || "—"} onClick={() => setEditSheet("personal")} />
        <ProfileRow label="Height" value={profile.height ? `${profile.height} cm` : "—"} onClick={() => setEditSheet("personal")} />
        <ProfileRow label="Weight" value={profile.weight ? `${profile.weight} kg` : "—"} onClick={() => setEditSheet("personal")} last />
      </ProfileSection>

      <ProfileSection title="Goals">
        <ProfileRow label="Current goal" value={findLabel(GOALS, profile.goal, "Not set")} onClick={() => setEditSheet("goal")} />
        <ProfileRow label="Activity level" value={findLabel(ACTIVITY_LEVELS, profile.activity, "Not set")} onClick={() => setEditSheet("goal")} />
        <ProfileRow label="Exercise frequency" value={findLabel(EXERCISE_FREQS, profile.exercise, "Not set")} onClick={() => setEditSheet("goal")} last />
      </ProfileSection>

      <ProfileSection title="Diet & Preferences">
        <ProfileRow label="Diet type" value={findLabel(DIETS, profile.diet, "Not set")} onClick={() => setEditSheet("food")} />
        <ProfileRow label="Foods I like" value={profile.likes.length ? profile.likes.join(", ") : "Not set"} onClick={() => setEditSheet("food")} />
        <ProfileRow label="Foods I dislike" value={profile.dislikes.length ? profile.dislikes.join(", ") : "Not set"} onClick={() => setEditSheet("food")} />
        <ProfileRow label="Ingredients to avoid" value={profile.avoid.length ? profile.avoid.join(", ") : "None"} onClick={() => setEditSheet("food")} />
        <ProfileRow label="Allergies" value={profile.allergies.length ? profile.allergies.join(", ") : "None"} onClick={() => setEditSheet("food")} last />
      </ProfileSection>

      <ProfileSection title="College Life">
        <ProfileRow
          label="Where I eat"
          value={profile.sources.length ? profile.sources.map((s) => findLabel(SOURCE_OPTIONS, s, s)).join(", ") : "Not set"}
          onClick={() => setEditSheet("college")}
        />
        <ProfileRow
          label="Favourite spots"
          value={
            profile.preferredLocations && profile.preferredLocations.length
              ? profile.preferredLocations.map((id) => (getFoodLocation(id) || {}).name || id).join(", ")
              : "None set"
          }
          onClick={() => setEditSheet("college")}
        />
        <ProfileRow label="College start" value={profile.collegeStart || "Not set"} onClick={() => setEditSheet("college")} />
        <ProfileRow label="College end" value={profile.collegeEnd || "Not set"} onClick={() => setEditSheet("college")} />
        <ProfileRow label="Wake time" value={profile.wakeTime || "Not set"} onClick={() => setEditSheet("college")} />
        <ProfileRow label="Sleep time" value={profile.sleepTime || "Not set"} onClick={() => setEditSheet("college")} last />
      </ProfileSection>

      <ProfileSection title="Plan Preferences">
        <ProfileRow label="Weekly plan" onClick={goToPlan} />
        <ProfileRow label="Monthly plan" onClick={goToPlan} />
        <ProfileRow label="Meal preferences" onClick={() => setEditSheet("food")} last />
      </ProfileSection>

      <ProfileSection title="Appearance">
        <ProfileRow label="Theme" value="Light" onClick={() => setEditSheet("appearance")} last />
      </ProfileSection>

      <ProfileSection title="Notifications">
        <div className="profile-row">
          <span>Weekly check-in &amp; plan reminders</span>
          <ToggleSwitch checked={notifications} onChange={setNotifications} label="Notifications" />
        </div>
      </ProfileSection>

      <ProfileSection title="Privacy">
        <ProfileRow label="Your data" onClick={() => setEditSheet("privacy")} />
        <ProfileRow label="Reset all data" onClick={() => setEditSheet("reset-confirm")} danger last />
      </ProfileSection>

      <ProfileSection title="About">
        <ProfileRow label="About DietYaar" onClick={() => setEditSheet("about")} last />
      </ProfileSection>

      <BottomSheet open={editSheet === "personal"} onClose={() => setEditSheet(null)} title="Personal details">
        <BasicInfoStep draft={profile} setDraft={setProfile} />
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={!personalValid} onClick={() => setEditSheet(null)}>
          Done
        </button>
      </BottomSheet>

      <BottomSheet open={editSheet === "goal"} onClose={() => setEditSheet(null)} title="Goal & activity">
        <GoalStep draft={profile} setDraft={setProfile} />
        <label className="field-label" style={{ marginTop: 20, display: "block" }}>
          Activity level
        </label>
        <div className="option-grid">
          {ACTIVITY_LEVELS.map((a) => (
            <OptionCard key={a.id} label={a.label} selected={profile.activity === a.id} onClick={() => setProfile({ ...profile, activity: a.id })} />
          ))}
        </div>
        <label className="field-label" style={{ marginTop: 20, display: "block" }}>
          Exercise frequency
        </label>
        <div className="option-grid">
          {EXERCISE_FREQS.map((a) => (
            <OptionCard key={a.id} label={a.label} selected={profile.exercise === a.id} onClick={() => setProfile({ ...profile, exercise: a.id })} />
          ))}
        </div>
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => setEditSheet(null)}>
          Done
        </button>
      </BottomSheet>

      <BottomSheet open={editSheet === "food"} onClose={() => setEditSheet(null)} title="Food preferences">
        <DietStep draft={profile} setDraft={setProfile} />
        <div style={{ marginTop: 20 }}>
          <FoodPrefStep draft={profile} setDraft={setProfile} />
        </div>
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => setEditSheet(null)}>
          Done
        </button>
      </BottomSheet>

      <BottomSheet open={editSheet === "college"} onClose={() => setEditSheet(null)} title="College life">
        <SourcesStep draft={profile} setDraft={setProfile} />
        {FOOD_LOCATIONS.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="field-label" style={{ marginBottom: 4 }}>
              Favourite spots (optional)
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
              We'll lean slightly toward these when recommending — never required.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FOOD_LOCATIONS.filter((l) => l.active).map((loc) => {
                const selected = (profile.preferredLocations || []).includes(loc.id);
                return (
                  <Chip
                    key={loc.id}
                    label={loc.name}
                    icon={MapPin}
                    active={selected}
                    onClick={() => {
                      const current = profile.preferredLocations || [];
                      const next = selected ? current.filter((id) => id !== loc.id) : [...current, loc.id];
                      setProfile({ ...profile, preferredLocations: next });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <div className="field-label" style={{ marginBottom: 4 }}>
            Your schedule
          </div>
          <LifestyleTimesFields draft={profile} setDraft={setProfile} />
        </div>
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => setEditSheet(null)}>
          Done
        </button>
      </BottomSheet>

      <BottomSheet open={editSheet === "appearance"} onClose={() => setEditSheet(null)} title="Appearance">
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Dark mode is coming soon. For now, DietYaar uses this light, warm theme.
        </p>
      </BottomSheet>

      <BottomSheet open={editSheet === "about"} onClose={() => setEditSheet(null)} title="About DietYaar">
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          DietYaar helps you build a realistic eating routine around your mess, canteen, cafés and college life.
        </p>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 12 }}>
          Our philosophy: better choices, not perfect choices. DietYaar is completely free — no subscriptions, ads or premium plans.
        </p>
      </BottomSheet>

      <BottomSheet open={editSheet === "privacy"} onClose={() => setEditSheet(null)} title="Privacy">
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Your profile, plan and photo are saved only for you on this device, so your plan is still here next time you open DietYaar. Nothing is uploaded or shared.
        </p>
      </BottomSheet>

      <BottomSheet open={editSheet === "reset-confirm"} onClose={() => setEditSheet(null)} title="Reset DietYaar?">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--error-tint)", padding: 14, borderRadius: 16, marginBottom: 16 }}>
          <AlertTriangle size={18} style={{ color: "var(--error)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>This clears your profile, plan and photo from this device. This can't be undone.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditSheet(null)}>
            Cancel
          </button>
          <button
            className="btn-danger"
            style={{ flex: 1 }}
            onClick={() => {
              setEditSheet(null);
              onResetAll();
            }}
          >
            Reset
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ----------------------------------------------------------------------
   MEAL SWAP + RECOMMENDATION + CRAVING SHEETS
---------------------------------------------------------------------- */

function MealSwapSheet({ open, onClose, mealType, currentCombo, currentComboId, profile, dow, onSelect }) {
  const [selectingId, setSelectingId] = useState(null);
  const [widen, setWiden] = useState(false); // explicit, per-sheet: look beyond the student's selected places
  useEffect(() => {
    if (!open) {
      setSelectingId(null);
      setWiden(false);
    }
  }, [open]);

  // Same pipeline (diet, allergies, avoided ingredients, selected places, budget order) as the
  // original recommendation — a swap can never be less careful than the suggestion it replaces.
  const pool = mealType ? getRecommendedMeals(mealType, profile, dow, { allowAnySource: widen }) : [];
  const alternatives = pool.filter((c) => c.id !== currentComboId).slice(0, 4);
  const widenedCount = mealType && !widen ? getAlternatives(currentComboId, mealType, profile, dow, { allowAnySource: true }).length : 0;
  const canWiden = !widen && alternatives.length === 0 && widenedCount > 0;
  const limit = profile.budgetLimit;
  const emptyMessage =
    pool.length > 0
      ? "This is the only option that fits your diet, allergies and selected places for this meal."
      : mealType
      ? explainNoResults(mealType, profile, dow).message
      : "";

  const handlePick = (c) => {
    setSelectingId(c.id);
    setTimeout(() => onSelect(c.id), 160);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={mealType ? `Swap ${MEAL_LABELS[mealType]}` : "Swap meal"}>
      {currentCombo && (
        <div className="swap-current">
          <div className="swap-current-label">Current</div>
          <div className="swap-current-name">{currentCombo.items.join(" + ")}</div>
        </div>
      )}
      <div className="swap-alt-label">Alternatives that fit your settings</div>
      {widen && <div className="notice">Including food places outside the sources you selected.</div>}
      {alternatives.length === 0 ? (
        <EmptyState
          title="No suitable swap found"
          desc={emptyMessage}
          action={
            canWiden ? (
              <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setWiden(true)}>
                Look beyond my selected places
              </button>
            ) : null
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alternatives.map((c) => {
            const min = getMinPrice(c);
            const overBudget = typeof limit === "number" && (min === null || min > limit);
            const cautions = getUncertaintyNotes(c, profile).filter((n) => /^Can't confirm|^Ingredients unconfirmed for/.test(n));
            return (
              <button key={c.id} className={cx("swap-option", selectingId === c.id && "swap-option-selected")} onClick={() => handlePick(c)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.items.join(" + ")}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {getSourceTagText(c)} · {DIET_CLASS_LABELS[getDietClass(c)]}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{getComboReason(c, profile)}</div>
                  {overBudget && <div className="swap-flag">Price is not confirmed within your {formatINR(limit)} budget</div>}
                  {cautions.map((n) => (
                    <div key={n} className="swap-flag">
                      {n}
                    </div>
                  ))}
                </div>
                {selectingId === c.id ? <Check size={16} style={{ color: "var(--primary)" }} /> : <ArrowRight size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

function RecommendationSheet({ open, onClose, title, subtitle, items, profile, onSelect, emptyTitle, emptyDesc }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {subtitle && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 14 }}>{subtitle}</p>}
      {items.length === 0 ? (
        <EmptyState title={emptyTitle || "Nothing to suggest"} desc={emptyDesc || "Try again in a bit."} icon={Sparkles} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((c) => (
            <button key={c.id} className="swap-option" onClick={() => onSelect(c)}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.items.join(" + ")}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{getSourceTagText(c)}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{getComboReason(c, profile)}</div>
              </div>
              <ArrowRight size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

function CravingJunkSheet({ open, onClose, profile, dow, targetMealType, onPick }) {
  const options = open ? getJunkOptions(profile, dow) : [];
  return (
    <BottomSheet open={open} onClose={onClose} title="Craving something junky?">
      <div className="craving-lead">
        <span className="craving-lead-title">You can have it.</span>
        <span className="craving-lead-sub">Just make it a little better with an easy add-on.</span>
      </div>
      {options.length === 0 ? (
        <EmptyState title="Nothing here yet" desc="No treat options match your preferences right now." icon={Pizza} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {options.map((c) => (
            <div key={c.id} className="craving-option">
              <div className="craving-option-name">{c.items.join(" + ")}</div>
              <div className="craving-option-source">{getSourceTagText(c)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {JUNK_BOOSTS.map((b) => (
                  <Chip key={b} label={`+ ${b}`} onClick={() => onPick(c.id, b, targetMealType)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

function DayDetailSheet({ date, onClose, weekPlan, extras, completed, onSwap, onToggleDone, weekDates, mealHistory }) {
  if (!date) return null;
  const dateKey = dateKeyOf(date);
  const title = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const inThisWeek = weekDates.some((d) => dateKeyOf(d) === dateKey);

  // Outside the current week there is no live plan to act on — only what really happened.
  if (!inThisWeek) {
    const logged = MEAL_TYPES.map((mt) => ({ mt, rec: mealHistory.filter((r) => recordDateKey(r) === dateKey && r.mealType === mt)[0] })).filter((x) => x.rec);
    const isFuture = date > new Date();
    return (
      <BottomSheet open={!!date} onClose={onClose} title={title}>
        {logged.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logged.map(({ mt, rec }) => {
              const combo = getComboById(rec.comboId);
              return (
                <div key={mt} className="mini-meal">
                  <div className="mini-meal-top">
                    <span className="meal-type-label-sm">{MEAL_LABELS[mt]}</span>
                    <span className="align-badge" title="Logged as eaten">
                      <Check size={10} />
                    </span>
                  </div>
                  <div className="mini-meal-items">{combo ? comboDisplay(combo, []) : "Meal no longer in the menu data"}</div>
                  {combo && <div className="mini-meal-source">{getSourceTagText(combo)}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={isFuture ? "Not planned yet" : "Nothing logged"}
            desc={isFuture ? "Your plan for this day appears in the Weekly view once its week begins." : "No meals were logged as eaten on this day."}
          />
        )}
      </BottomSheet>
    );
  }

  const dow = (date.getDay() + 6) % 7;
  const dayPlan = weekPlan[dow] || {};
  return (
    <BottomSheet open={!!date} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MEAL_TYPES.map((mt) => {
          const combo = getComboById(dayPlan[mt]);
          const key = `${dow}-${mt}`;
          const done = !!completed[key];
          return (
            <MiniMealCard
              key={mt}
              mealType={mt}
              combo={combo}
              done={done}
              extraList={extras[key]}
              onSwap={() => onSwap(dow, mt)}
              onToggleDone={() => onToggleDone(dow, mt)}
            />
          );
        })}
      </div>
    </BottomSheet>
  );
}

/* ----------------------------------------------------------------------
   APP
---------------------------------------------------------------------- */

export default function DietYaarApp() {
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState("landing");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_PROFILE);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [weekPlan, setWeekPlan] = useState({});
  const [completed, setCompleted] = useState({});
  const [extras, setExtras] = useState({});
  const [missed, setMissed] = useState({}); // Plan → Daily "Missed" state, parallel to `completed`
  const [missedSlot, setMissedSlot] = useState(null); // { day, mealType } — opens alternatives for an explicitly-missed meal
  const [swap, setSwap] = useState(null);
  const [planView, setPlanView] = useState("daily");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dayDetail, setDayDetail] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [toast, setToast] = useState("");
  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [mealHistory, setMealHistory] = useState([]); // [{ comboId, day, mealType, timestamp }]
  const [rightNowSkipped, setRightNowSkipped] = useState([]); // combo ids dismissed via "show me something else"
  const [weightHistory, setWeightHistory] = useState([]); // [{ date, weight, height, bmi }]
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);

  const [widenSources, setWidenSources] = useState(false); // session-only, explicit: look beyond selected places

  const weekDates = useMemo(() => getWeekDates(), []);
  const weekKey = dateKeyOf(weekDates[0]);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const mealContext = getMealContext(new Date());
  const currentMealType = mealContext.mealType;

  // "What should you eat right now?" — reuses the same getRecommendedMeals() engine,
  // just feeding it recent meal history + in-session skips as the variety signal.
  // Home shows the top 3 as cards; "show me something else" advances past all 3.
  // Variety signal: recent real history + what was already completed today + in-session skips.
  const todayDoneIds = MEAL_TYPES.filter((mt) => completed[`${todayIndex}-${mt}`]).map((mt) => (weekPlan[todayIndex] || {})[mt]).filter(Boolean);
  const rightNowRecentIds = useMemo(
    () => [...new Set([...getRecentMeals(mealHistory, 5), ...todayDoneIds, ...rightNowSkipped])],
    [mealHistory, todayDoneIds.join(","), rightNowSkipped]
  );
  const rightNowRanked = useMemo(
    () => getRecommendedMeals(currentMealType, profile, todayIndex, { recentIds: rightNowRecentIds, isBetween: mealContext.isBetween, allowAnySource: widenSources }),
    [currentMealType, mealContext.isBetween, profile, todayIndex, rightNowRecentIds, widenSources]
  );
  // Never re-show a dismissed option in the same meal window. If the student
  // cycles through every eligible option, show an honest exhausted state.
  const rightNowAvailable = useMemo(
    () => rightNowRanked.filter((c) => !rightNowSkipped.includes(c.id)),
    [rightNowRanked, rightNowSkipped]
  );
  const rightNowItems = rightNowAvailable.slice(0, 3);
  const rightNowReasonContext = { isVariety: rightNowRecentIds.length > 0 };
  // When nothing qualifies, say exactly why (diet / allergies / selected places) instead of guessing.
  const rightNowPreferredMissing =
    (profile.preferredLocations || []).length > 0 &&
    rightNowItems.length > 0 &&
    !rightNowRanked.some((c) => c.locationId && profile.preferredLocations.includes(c.locationId));
  const rightNowEmpty = useMemo(() => {
    if (rightNowItems.length > 0) return null;
    if (rightNowRanked.length > 0 && rightNowSkipped.length > 0) {
      return { kind: "exhausted", canWiden: false, message: "You've viewed all suitable options for this meal window. You can come back when the meal window changes." };
    }
    return explainNoResults(currentMealType, profile, todayIndex);
  }, [rightNowItems.length, rightNowRanked.length, rightNowSkipped.length, currentMealType, profile, todayIndex]);

  // A stale skip list from an earlier window shouldn't linger once the window
  // truly changes — keyed on the specific segment (not just the engine
  // mealType), so two different gaps that both resolve to "snack" don't share
  // a skip list.
  useEffect(() => {
    setRightNowSkipped([]);
  }, [mealContext.windowKey]);

  /* ---- hydrate from persistent storage on first mount ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadAppState();
      const savedPhoto = await loadProfilePhoto();
      if (cancelled) return;
      if (saved) {
        const restoredProfile = { ...EMPTY_PROFILE, ...(saved.profile || {}) };
        const restoredHistory = saved.mealHistory || [];
        // Completion marks belong to one calendar week. If the app is reopened in a later
        // week, rebuild them from the real history instead of showing last week's ticks.
        const sameWeek = saved.weekStart === dateKeyOf(getWeekDates()[0]);
        const restoredCompleted = sameWeek ? saved.completed || {} : deriveCompletedForWeek(restoredHistory, getWeekDates());
        setProfile(restoredProfile);
        const restoredPlan = sameWeek
          ? sanitizeWeekPlan(saved.weekPlan || {}, restoredProfile, restoredCompleted)
          : generateWeekPlan(restoredProfile);
        setWeekPlan(restoredPlan);
        setCompleted(restoredCompleted);
        setExtras(sameWeek ? saved.extras || {} : {});
        setMissed(sameWeek ? saved.missed || {} : {});
        setNotifications(saved.notifications !== undefined ? saved.notifications : true);
        setMealHistory(restoredHistory);
        setWeightHistory(saved.weightHistory || []);
        if (saved.profile && saved.profile.name) setScreen("dashboard");
      }
      if (savedPhoto) setPhoto(savedPhoto);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- debounced save whenever meaningful state changes ---- */
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAppState({ profile, weekPlan, completed, extras, missed, notifications, mealHistory, weightHistory, weekStart: weekKey });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, profile, weekPlan, completed, extras, missed, notifications, mealHistory, weightHistory, weekKey]);

  /* ---- keep the saved plan in step with the profile ---- */
  const planFp = planFingerprint(profile);
  const lastPlanFp = useRef(null);
  useEffect(() => {
    if (!hydrated) return;
    if (Object.keys(weekPlan).length === 0) {
      lastPlanFp.current = null;
      return;
    }
    if (lastPlanFp.current === null) {
      lastPlanFp.current = planFp;
      return;
    }
    if (lastPlanFp.current === planFp) return;
    lastPlanFp.current = planFp;
    const rebuilt = rebuildWeekPlan(weekPlan, profile, completed);
    if (JSON.stringify(rebuilt) !== JSON.stringify(weekPlan)) {
      setWeekPlan(rebuilt);
      showToast("Plan updated for your new preferences");
    }
    // eslint-disable-next-line
  }, [hydrated, planFp, weekPlan]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  const handleStartOnboarding = () => {
    setDraft(EMPTY_PROFILE);
    setOnboardingStep(0);
    setScreen("onboarding");
  };

  const handleLogoClick = () => setScreen("landing");

  const handleDemo = () => {
    setProfile(DEMO_PROFILE);
    setWeekPlan(generateWeekPlan(DEMO_PROFILE));
    setCompleted(deriveCompletedForWeek(mealHistory, weekDates));
    setExtras({});
    setMissed({});
    setScreen("dashboard");
    setDashboardLoading(true);
    setTimeout(() => setDashboardLoading(false), 500);
  };

  const handleFinishOnboarding = () => {
    if (!validateProfile(draft).valid) return;
    setIsGenerating(true);
    setTimeout(() => {
      setProfile(draft);
      setWeekPlan(generateWeekPlan(draft));
      setCompleted(deriveCompletedForWeek(mealHistory, weekDates));
      setExtras({});
      setMissed({});
      setIsGenerating(false);
      setScreen("dashboard");
      setDashboardLoading(true);
      setTimeout(() => setDashboardLoading(false), 500);
    }, 900);
  };

  const handleSwapOpen = (day, mealType) => setSwap({ day, mealType });

  const dateKeyForDay = (day) => dateKeyOf(weekDates[day]);

  const handleSwapSelect = (comboId) => {
    const { day, mealType } = swap;
    const key = `${day}-${mealType}`;
    setWeekPlan((prev) => ({ ...prev, [day]: { ...prev[day], [mealType]: comboId } }));
    setExtras((prev) => ({ ...prev, [key]: [] }));
    setMissed((prev) => ({ ...prev, [key]: false }));
    // Swapping an already-eaten meal means "this is what I actually ate": keep history in step.
    if (completed[key]) setMealHistory((prev) => upsertCompletion(prev, { comboId, day, mealType, dateKey: dateKeyForDay(day) }));
    setSwap(null);
    showToast("Meal swapped");
  };

  // Completion is derived from one decision, applied to the status, the plan slot's
  // history record and the missed flag together. Repeated taps cannot create duplicates.
  const handleToggleDone = (day, mealType) => {
    const key = `${day}-${mealType}`;
    const comboId = weekPlan[day] ? weekPlan[day][mealType] : null;
    if (!comboId) return; // nothing was planned here, so there is nothing to mark as eaten
    const nextDone = !completed[key];
    const dateKey = dateKeyForDay(day);
    setCompleted((prev) => ({ ...prev, [key]: nextDone }));
    setMealHistory((prev) =>
      nextDone ? upsertCompletion(prev, { comboId, day, mealType, dateKey }) : removeCompletion(prev, dateKey, mealType)
    );
    setMissed((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  // Plan → Daily's explicit "Missed" action. Distinct from simply not-yet-done —
  // opens the same alternatives sheet the engine already powers so it's easy to
  // adjust the day, without inventing a second recommendation path.
  const handleMarkMissed = (day, mealType) => {
    const key = `${day}-${mealType}`;
    setMissed((prev) => ({ ...prev, [key]: true }));
    setCompleted((prev) => ({ ...prev, [key]: false }));
    setMealHistory((prev) => removeCompletion(prev, dateKeyForDay(day), mealType));
    setMissedSlot({ day, mealType });
  };

  const handleAddExtra = (day, mealType, item) => {
    const key = `${day}-${mealType}`;
    setExtras((prev) => {
      const list = prev[key] || [];
      if (list.includes(item)) return prev;
      return { ...prev, [key]: [...list, item] };
    });
    showToast(`${item.charAt(0).toUpperCase() + item.slice(1)} added`);
  };

  const handleRegenerateDay = (day) => {
    setWeekPlan((prev) => {
      const next = { ...prev };
      const newDay = {};
      MEAL_TYPES.forEach((mt) => {
        const currentId = prev[day] ? prev[day][mt] : null;
        if (completed[`${day}-${mt}`]) {
          newDay[mt] = currentId; // eaten meals are history — never rewritten
          return;
        }
        const list = getRecommendedMeals(mt, profile, day, {}).filter((c) => c.id !== currentId);
        const pool = list.length > 0 ? list : getRecommendedMeals(mt, profile, day, {});
        const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))] || null;
        newDay[mt] = pick ? pick.id : null; // no valid option -> honest empty slot, never a stale/invalid one
      });
      next[day] = newDay;
      return next;
    });
    showToast("Day regenerated");
  };

  const handleQuickPick = (mealType, comboId, opts) => {
    opts = opts || {};
    setWeekPlan((prev) => ({ ...prev, [todayIndex]: { ...prev[todayIndex], [mealType]: comboId } }));
    if (opts.markDone) {
      setCompleted((prev) => ({ ...prev, [`${todayIndex}-${mealType}`]: true }));
      setMissed((prev) => ({ ...prev, [`${todayIndex}-${mealType}`]: false }));
      setMealHistory((prev) => upsertCompletion(prev, { comboId, day: todayIndex, mealType, dateKey: dateKeyOf(new Date()) }));
    }
    showToast(opts.markDone ? "Day adjusted" : "Updated your plan");
  };

  const handleCravingPick = (comboId, extra, mealType) => {
    setWeekPlan((prev) => ({ ...prev, [todayIndex]: { ...prev[todayIndex], [mealType]: comboId } }));
    setExtras((prev) => ({ ...prev, [`${todayIndex}-${mealType}`]: [extra] }));
    setActiveQuickAction(null);
    showToast("Nice pairing — added to your plan");
  };

  // Section 16 — "Eat this": integrates with the existing plan/completion state
  // (no separate disconnected state) and logs to meal history for future variety.
  const handleEatThis = (combo) => {
    setWeekPlan((prev) => ({ ...prev, [todayIndex]: { ...prev[todayIndex], [currentMealType]: combo.id } }));
    setCompleted((prev) => ({ ...prev, [`${todayIndex}-${currentMealType}`]: true }));
    setExtras((prev) => ({ ...prev, [`${todayIndex}-${currentMealType}`]: [] }));
    setMissed((prev) => ({ ...prev, [`${todayIndex}-${currentMealType}`]: false }));
    setMealHistory((prev) => upsertCompletion(prev, { comboId: combo.id, day: todayIndex, mealType: currentMealType, dateKey: dateKeyOf(new Date()) }));
    setRightNowSkipped([]);
    showToast(`Marked ${combo.items.join(" + ")} as eaten`);
  };

  // Section 17 — cycles to the next best recommendation via the same scoring
  // engine (variety penalty), never a random pick from the whole menu. Advances
  // past the whole displayed set of 3 so the refreshed set is genuinely different.
  const handleShowSomethingElse = (comboIds) => {
    setRightNowSkipped((prev) => {
      const next = [...prev];
      comboIds.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  };

  const handleSetBudget = (limit) => {
    setProfile((prev) => ({ ...prev, budgetLimit: limit }));
    showToast(limit === null ? "Budget limit removed" : `Budget set to ≤ ${formatINR(limit)}`);
  };

  // Section 1 — weekly check-in: updates the profile's current weight and
  // appends a { date, weight, height, bmi } snapshot to the existing history.
  const handleWeightCheckIn = (weight) => {
    const numWeight = Number(weight);
    const bmi = calculateBMI(numWeight, profile.height);
    const entry = {
      date: new Date().toISOString(),
      weight: numWeight,
      height: profile.height ? Number(profile.height) : null,
      bmi,
    };
    setProfile((prev) => ({ ...prev, weight: String(weight) }));
    setWeightHistory((prev) => [...prev, entry]);
    setCheckInOpen(false);
    showToast("Progress updated");
  };

  const handlePhotoUpload = async (file) => {
    setPhotoLoading(true);
    try {
      const dataUrl = await uploadProfilePhoto(profile.name || "guest", file);
      setPhoto(dataUrl);
      showToast("Photo updated");
    } catch (e) {
      showToast("Could not update photo");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePhotoRemove = async () => {
    setPhoto(null);
    await removeProfilePhotoFromStorage();
    showToast("Photo removed");
  };

  const handleResetAll = async () => {
    await clearAllStorage();
    setProfile(EMPTY_PROFILE);
    setWeekPlan({});
    setCompleted({});
    setExtras({});
    setMissed({});
    setMissedSlot(null);
    setPhoto(null);
    setNotifications(true);
    setMealHistory([]);
    setRightNowSkipped([]);
    setWeightHistory([]);
    setCheckInOpen(false);
    setProgressOpen(false);
    setScreen("landing");
    showToast("All data cleared");
  };

  const currentComboIdForSwap = swap ? (weekPlan[swap.day] ? weekPlan[swap.day][swap.mealType] : null) : null;
  const currentComboForSwap = getComboById(currentComboIdForSwap);
  const swapDow = swap ? swap.day : todayIndex;

  if (!hydrated) {
    return (
      <div className="dy-root" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <GlobalStyles />
        <div className="boot-screen">
          <div className="boot-mark">DietYaar</div>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="dy-root"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "var(--bg)",
        minHeight: "100vh",
        color: "var(--text)",
      }}
    >
      <GlobalStyles />
      {screen !== "landing" && screen !== "onboarding" && (
        <>
          <MobileHeader onLogoClick={handleLogoClick} />
          <TopNav screen={screen} setScreen={setScreen} onLogoClick={handleLogoClick} />
        </>
      )}

      <div key={screen} className={cx("app-main", screen === "landing" && "landing-page")}>
        {screen === "landing" && <Landing onStart={handleStartOnboarding} onDemo={handleDemo} />}

        {screen === "onboarding" && (
          <Onboarding
            step={onboardingStep}
            setStep={setOnboardingStep}
            draft={draft}
            setDraft={setDraft}
            onFinish={handleFinishOnboarding}
            isGenerating={isGenerating}
          />
        )}

        {screen === "dashboard" && (
          <Dashboard
            profile={profile}
            completed={completed}
            todayIndex={todayIndex}
            mealContext={mealContext}
            rightNowItems={rightNowItems}
            rightNowReasonContext={rightNowReasonContext}
            onEatThis={handleEatThis}
            onShowSomethingElse={handleShowSomethingElse}
            onOpenCraving={() => setActiveQuickAction("craving")}
            weightHistory={weightHistory}
            onOpenProgress={() => setProgressOpen(true)}
            onOpenBudget={() => setBudgetSheetOpen(true)}
            emptyInfo={rightNowEmpty}
            onResetSkipped={() => setRightNowSkipped([])}
            widenSources={widenSources}
            onToggleWiden={() => setWidenSources((v) => !v)}
            onGoToProfile={() => setScreen("profile")}
            preferredMissing={rightNowPreferredMissing}
            loading={dashboardLoading}
          />
        )}

        {screen === "plan" && (
          <PlanScreen
            profile={profile}
            weekPlan={weekPlan}
            completed={completed}
            missed={missed}
            extras={extras}
            weekDates={weekDates}
            todayIndex={todayIndex}
            view={planView}
            setView={setPlanView}
            onSwap={handleSwapOpen}
            onToggleDone={handleToggleDone}
            onMarkMissed={handleMarkMissed}
            onAddExtra={handleAddExtra}
            onRegenerateDay={handleRegenerateDay}
            monthCursor={monthCursor}
            setMonthCursor={setMonthCursor}
            onSelectDate={setDayDetail}
            mealHistory={mealHistory}
          />
        )}

        {screen === "food" && <FoodScreen profile={profile} />}

        {screen === "profile" && (
          <ProfileScreen
            profile={profile}
            setProfile={setProfile}
            notifications={notifications}
            setNotifications={setNotifications}
            photo={photo}
            photoLoading={photoLoading}
            onPhotoUpload={handlePhotoUpload}
            onPhotoRemove={handlePhotoRemove}
            onResetAll={handleResetAll}
            goToPlan={() => setScreen("plan")}
          />
        )}
      </div>

      {screen !== "landing" && screen !== "onboarding" && <BottomNav screen={screen} setScreen={setScreen} />}

      <MealSwapSheet
        open={!!swap}
        onClose={() => setSwap(null)}
        mealType={swap ? swap.mealType : null}
        currentCombo={currentComboForSwap}
        currentComboId={currentComboIdForSwap}
        profile={profile}
        dow={swapDow}
        onSelect={handleSwapSelect}
      />

      <RecommendationSheet
        open={!!missedSlot}
        onClose={() => setMissedSlot(null)}
        title={missedSlot ? `Missed ${MEAL_LABELS[missedSlot.mealType]}?` : "Missed meal"}
        subtitle="No worries — here's how to adjust your day."
        items={missedSlot ? getQuickMeals(missedSlot.mealType, profile, missedSlot.day).slice(0, 4) : []}
        profile={profile}
        onSelect={(c) => {
          handleQuickPick(missedSlot.mealType, c.id, { markDone: true });
          setMissedSlot(null);
        }}
      />

      <BudgetSheet open={budgetSheetOpen} onClose={() => setBudgetSheetOpen(false)} value={profile.budgetLimit} onChange={handleSetBudget} />

      <CravingJunkSheet
        open={activeQuickAction === "craving"}
        onClose={() => setActiveQuickAction(null)}
        profile={profile}
        dow={todayIndex}
        targetMealType={currentMealType}
        onPick={handleCravingPick}
      />

      <WeightCheckInSheet open={checkInOpen} onClose={() => setCheckInOpen(false)} profile={profile} onSave={handleWeightCheckIn} />

      <ProgressSheet
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        profile={profile}
        weightHistory={weightHistory}
        onOpenCheckIn={() => {
          setProgressOpen(false);
          setCheckInOpen(true);
        }}
      />

      <DayDetailSheet
        date={dayDetail}
        onClose={() => setDayDetail(null)}
        weekPlan={weekPlan}
        extras={extras}
        completed={completed}
        weekDates={weekDates}
        mealHistory={mealHistory}
        onSwap={(day, mt) => {
          setDayDetail(null);
          handleSwapOpen(day, mt);
        }}
        onToggleDone={handleToggleDone}
      />

      <Toast message={toast} />
    </div>
  );
}
