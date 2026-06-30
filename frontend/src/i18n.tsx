import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "el" | "en";

type Dict = Record<string, string>;

const el: Dict = {
  appName: "GR-oom It",
  tagline: "Βρες το ιδανικό κομμωτήριο & pet shop",

  "tab.find": "Αναζήτηση",
  "tab.browse": "Κατάστημα",
  "tab.saved": "Αποθηκευμένα",
  "tab.profile": "Προφίλ",

  "find.heading": "Τι ψάχνεις σήμερα;",
  "find.sub": "Βρες την καλύτερη φροντίδα για το κατοικίδιό σου. Συμπλήρωσε τα κενά παρακάτω.",
  "find.need": "Χρειάζομαι",
  "find.in": "στην περιοχή",
  "find.when": "για",
  "find.locationPlaceholder": "Κοντά μου",
  "find.useMyLocation": "Χρησιμοποίησε την τοποθεσία μου",
  "find.search": "Αναζήτηση",
  "find.quick": "Γρήγορη αναζήτηση",

  "type.all": "Οποιοδήποτε",
  "type.groomer": "Κομμωτήριο",
  "type.shop": "Pet Shop",
  "type.both": "Και τα δύο",

  "cat.all": "Όλα",
  "cat.groomer": "Κομμωτήρια",
  "cat.shop": "Pet Shops",
  "cat.both": "Και τα 2",

  "day.today": "Σήμερα",
  "day.tomorrow": "Αύριο",
  "day.any": "Οποιαδήποτε μέρα",
  "day.0": "Δευτέρα",
  "day.1": "Τρίτη",
  "day.2": "Τετάρτη",
  "day.3": "Πέμπτη",
  "day.4": "Παρασκευή",
  "day.5": "Σάββατο",
  "day.6": "Κυριακή",

  "find.pickDate": "Επίλεξε ημερομηνία",
  "common.done": "Έτοιμο",
  "wshort.0": "Δε", "wshort.1": "Τρ", "wshort.2": "Τε", "wshort.3": "Πε", "wshort.4": "Πα", "wshort.5": "Σα", "wshort.6": "Κυ",
  "month.0": "Ιανουάριος", "month.1": "Φεβρουάριος", "month.2": "Μάρτιος", "month.3": "Απρίλιος", "month.4": "Μάιος", "month.5": "Ιούνιος", "month.6": "Ιούλιος", "month.7": "Αύγουστος", "month.8": "Σεπτέμβριος", "month.9": "Οκτώβριος", "month.10": "Νοέμβριος", "month.11": "Δεκέμβριος",

  "browse.searchPlaceholder": "Αναζήτηση με όνομα…",
  "browse.results": "{count} αποτελέσματα",
  "browse.list": "Λίστα",
  "browse.map": "Χάρτης",
  "browse.km": "χλμ",
  "filter.openNow": "Ανοιχτά",
  "filter.open": "Ανοιχτά",
  "filter.until": "Μέχρι",
  "filter.open24": "Ανοιχτό 24ω",
  "filter.any": "Οποιαδήποτε",
  "card.closes": "έως {time}",
  "card.open24": "24ω",
  "filter.clear": "Καθαρισμός",
  "sort.label": "Ταξινόμηση",
  "sort.recommended": "Προτεινόμενα",
  "sort.distance": "Απόσταση",
  "sort.rating": "Βαθμολογία",

  "common.open": "Ανοιχτό",
  "common.closed": "Κλειστό",
  "common.groomer": "Κομμωτήριο",
  "common.shop": "Pet Shop",
  "common.both": "Κομμ. & Shop",
  "common.retry": "Δοκίμασε ξανά",
  "common.loading": "Φόρτωση…",
  "common.noResults": "Δεν βρέθηκαν καταστήματα. Δοκίμασε άλλο φίλτρο!",
  "common.error": "Κάτι πήγε στραβά.",

  "shop.ratings": "αξιολογήσεις",
  "shop.openNow": "Ανοιχτό τώρα",
  "shop.closedNow": "Κλειστό τώρα",
  "shop.hoursNA": "Χωρίς ωράριο",
  "shop.contact": "Στοιχεία επικοινωνίας",
  "shop.location": "Τοποθεσία",
  "map.near": "Κοντά σου",
  "map.expand": "Προβολή χάρτη",
  "shop.phone": "Τηλέφωνο",
  "shop.website": "Ιστοσελίδα",
  "shop.hours": "Ωράριο λειτουργίας",
  "shop.reviews": "Κριτικές",
  "shop.noReviews": "Δεν υπάρχουν κριτικές ακόμη.",
  "shop.moreReviews": "Δες όλες τις κριτικές στο Google",
  "shop.call": "Κλήση",
  "shop.directions": "Οδηγίες",
  "shop.closedLabel": "Κλειστά",
  "shop.loadError": "Αποτυχία φόρτωσης στοιχείων.",

  "saved.title": "Αποθηκευμένα",
  "saved.sub": "Τα αγαπημένα σου μέρη",
  "saved.empty": "Δεν έχεις αποθηκεύσει μέρη. Πάτα την καρδιά σε ένα κατάστημα για να το σώσεις.",

  "profile.title": "Προφίλ",
  "profile.welcome": "Καλώς ήρθες στο",
  "profile.guest": "Περιήγηση ως επισκέπτης",
  "profile.savedNote": "Τα αποθηκευμένα σου κρατούνται σε αυτή τη συσκευή",
  "profile.language": "Γλώσσα",
  "support.title": "Υποστήριξη",
  "support.removeAdsTitle": "Αφαίρεση διαφημίσεων",
  "support.desc": "Μία εφάπαξ αγορά αφαιρεί όλες τις διαφημίσεις και υποστηρίζει την ανάπτυξη της εφαρμογής.",
  "support.buy": "Αφαίρεση διαφημίσεων & υποστήριξη",
  "support.restore": "Επαναφορά αγοράς",
  "support.thanks": "Ευχαριστούμε για την υποστήριξη! Οι διαφημίσεις αφαιρέθηκαν.",
  "support.unavailable": "Διαθέσιμο στη δημοσιευμένη εφαρμογή.",
  "support.processing": "Επεξεργασία…",
  "support.failed": "Η αγορά απέτυχε. Δοκίμασε ξανά.",
  "support.noPurchases": "Δεν βρέθηκαν προηγούμενες αγορές.",
  "support.thanksAdvance": "Σε ευχαριστούμε εκ των προτέρων 💛",
  "profile.footer": "GR-oom It · βρες την καλύτερη φροντίδα για το κατοικίδιό σου",
};

const en: Dict = {
  appName: "GR-oom It",
  tagline: "Find the perfect groomer & pet shop",

  "tab.find": "Find",
  "tab.browse": "Browse",
  "tab.saved": "Saved",
  "tab.profile": "Profile",

  "find.heading": "What are you looking for today?",
  "find.sub": "Find the best care for your pet. Just fill in the blanks below.",
  "find.need": "I need a",
  "find.in": "in",
  "find.when": "for",
  "find.locationPlaceholder": "Near me",
  "find.useMyLocation": "Use my location",
  "find.search": "Search",
  "find.quick": "Quick search",

  "type.all": "Either",
  "type.groomer": "Groomer",
  "type.shop": "Pet Shop",
  "type.both": "Both",

  "cat.all": "All",
  "cat.groomer": "Groomers",
  "cat.shop": "Pet Shops",
  "cat.both": "Both",

  "day.today": "Today",
  "day.tomorrow": "Tomorrow",
  "day.any": "Any day",
  "day.0": "Monday",
  "day.1": "Tuesday",
  "day.2": "Wednesday",
  "day.3": "Thursday",
  "day.4": "Friday",
  "day.5": "Saturday",
  "day.6": "Sunday",

  "find.pickDate": "Pick a date",
  "common.done": "Done",
  "wshort.0": "Mo", "wshort.1": "Tu", "wshort.2": "We", "wshort.3": "Th", "wshort.4": "Fr", "wshort.5": "Sa", "wshort.6": "Su",
  "month.0": "January", "month.1": "February", "month.2": "March", "month.3": "April", "month.4": "May", "month.5": "June", "month.6": "July", "month.7": "August", "month.8": "September", "month.9": "October", "month.10": "November", "month.11": "December",

  "browse.searchPlaceholder": "Search by name…",
  "browse.results": "{count} results",
  "browse.list": "List",
  "browse.map": "Map",
  "browse.km": "km",
  "filter.openNow": "Open",
  "filter.open": "Open",
  "filter.until": "Until",
  "filter.open24": "Open 24h",
  "filter.any": "Any",
  "card.closes": "until {time}",
  "card.open24": "24h",
  "filter.clear": "Clear",
  "sort.label": "Sort",
  "sort.recommended": "Recommended",
  "sort.distance": "Distance",
  "sort.rating": "Rating",

  "common.open": "Open",
  "common.closed": "Closed",
  "common.groomer": "Groomer",
  "common.shop": "Pet Shop",
  "common.both": "Groomer & Shop",
  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.noResults": "No shops found. Try another filter!",
  "common.error": "Something went wrong.",

  "shop.ratings": "ratings",
  "shop.openNow": "Open now",
  "shop.closedNow": "Closed now",
  "shop.hoursNA": "Hours n/a",
  "shop.contact": "Contact",
  "shop.location": "Location",
  "map.near": "Near you",
  "map.expand": "View map",
  "shop.phone": "Phone",
  "shop.website": "Website",
  "shop.hours": "Opening hours",
  "shop.reviews": "Reviews",
  "shop.noReviews": "No reviews yet.",
  "shop.moreReviews": "See all reviews on Google",
  "shop.call": "Call",
  "shop.directions": "Directions",
  "shop.closedLabel": "Closed",
  "shop.loadError": "Failed to load details.",

  "saved.title": "Saved",
  "saved.sub": "Your favourite spots",
  "saved.empty": "No saved places yet. Tap the heart on a shop to save it.",

  "profile.title": "Profile",
  "profile.welcome": "Welcome to",
  "profile.guest": "Browsing as guest",
  "profile.savedNote": "Your saved spots are kept on this device",
  "profile.language": "Language",
  "support.title": "Support",
  "support.removeAdsTitle": "Remove ads",
  "support.desc": "A one-time purchase removes all ads and supports the app's development.",
  "support.buy": "Remove ads & support",
  "support.restore": "Restore purchase",
  "support.thanks": "Thanks for your support! Ads have been removed.",
  "support.unavailable": "Available in the published app.",
  "support.processing": "Processing…",
  "support.failed": "Purchase failed. Please try again.",
  "support.noPurchases": "No previous purchases found.",
  "support.thanksAdvance": "Thank you in advance 💛",
  "profile.footer": "GR-oom It · find the best pet care nearby",
};

const DICTS: Record<Lang, Dict> = { el, en };
const LANG_KEY = "groomit_lang";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx>({} as I18nCtx);
export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("el");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(LANG_KEY, "el");
      if (saved === "en" || saved === "el") setLangState(saved);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
