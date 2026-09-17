import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { THEMES, type Mood, type ThemeId } from "@/lib/themes";

export const SAVE_VERSION = 1;

export type SaveState = {
  version: number;
  clovers: number;
  equippedTheme: ThemeId;
  unlockedThemes: ThemeId[];
  todayMood: Mood | null;
  todayMoodDate: string;
  climbBest: number;
  bowlBest: number;
  wateredDate: string;
  growStage: number;
};

const defaults: SaveState = {
  version: SAVE_VERSION,
  clovers: 12,
  equippedTheme: "sprout",
  unlockedThemes: ["sprout"],
  todayMood: null,
  todayMoodDate: "",
  climbBest: 0,
  bowlBest: 0,
  wateredDate: "",
  growStage: 1,
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function migrate(raw: Partial<SaveState> | undefined): SaveState {
  const merged = { ...defaults, ...(raw ?? {}) };
  merged.version = SAVE_VERSION;
  if (!merged.unlockedThemes?.includes("sprout")) {
    merged.unlockedThemes = ["sprout", ...(merged.unlockedThemes ?? [])];
  }
  if (!THEMES[merged.equippedTheme]) merged.equippedTheme = "sprout";
  if (merged.todayMoodDate !== todayKey()) {
    merged.todayMood = null;
  }
  return merged;
}

type Actions = {
  hydrated: boolean;
  markHydrated: () => void;
  addClovers: (n: number) => void;
  setMood: (mood: Mood) => void;
  water: () => { grew: boolean; bonus: number };
  unlockTheme: (id: ThemeId, via: "clover" | "ad") => boolean;
  equipTheme: (id: ThemeId) => void;
  recordClimb: (height: number, earned: number) => void;
  recordBowl: (score: number, earned: number) => void;
};

export const usePlayground = create<SaveState & Actions>()(
  persist(
    (set, get) => ({
      ...defaults,
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),
      addClovers: (n) => set({ clovers: Math.max(0, get().clovers + n) }),
      setMood: (mood) => set({ todayMood: mood, todayMoodDate: todayKey() }),
      water: () => {
        const state = get();
        const today = todayKey();
        if (state.wateredDate === today) return { grew: false, bonus: 0 };
        const nextStage = Math.min(6, state.growStage + 1);
        const bonus = 3;
        set({
          wateredDate: today,
          growStage: nextStage,
          clovers: state.clovers + bonus,
        });
        return { grew: true, bonus };
      },
      unlockTheme: (id, via) => {
        const state = get();
        if (state.unlockedThemes.includes(id)) {
          set({ equippedTheme: id });
          return true;
        }
        const cost = THEMES[id].cost;
        if (via === "clover") {
          if (state.clovers < cost) return false;
          set({
            clovers: state.clovers - cost,
            unlockedThemes: [...state.unlockedThemes, id],
            equippedTheme: id,
          });
          return true;
        }
        set({
          unlockedThemes: [...state.unlockedThemes, id],
          equippedTheme: id,
        });
        return true;
      },
      equipTheme: (id) => {
        if (!get().unlockedThemes.includes(id)) return;
        set({ equippedTheme: id });
      },
      recordClimb: (height, earned) =>
        set({
          climbBest: Math.max(get().climbBest, height),
          clovers: get().clovers + earned,
        }),
      recordBowl: (score, earned) =>
        set({
          bowlBest: Math.max(get().bowlBest, score),
          clovers: get().clovers + earned,
        }),
    }),
    {
      name: "kong-playground-v1",
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        version: s.version,
        clovers: s.clovers,
        equippedTheme: s.equippedTheme,
        unlockedThemes: s.unlockedThemes,
        todayMood: s.todayMood,
        todayMoodDate: s.todayMoodDate,
        climbBest: s.climbBest,
        bowlBest: s.bowlBest,
        wateredDate: s.wateredDate,
        growStage: s.growStage,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...migrate(persisted as Partial<SaveState> | undefined),
      }),
    },
  ),
);
