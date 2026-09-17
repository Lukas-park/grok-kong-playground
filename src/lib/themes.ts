export type ThemeId = "sprout" | "chick" | "halloween" | "moon" | "maple" | "lavender";

export type Mood = "best" | "good" | "ok" | "bad" | "worst";

export const MOODS: { id: Mood; label: string; fill: string; face: string }[] = [
  { id: "best", label: "최고", fill: "#8ed14b", face: "#2f4a28" },
  { id: "good", label: "좋음", fill: "#61ae72", face: "#2f4a28" },
  { id: "ok", label: "보통", fill: "#e8c44d", face: "#5a4316" },
  { id: "bad", label: "별로", fill: "#c4b09a", face: "#4a4038" },
  { id: "worst", label: "최악", fill: "#8a8a8a", face: "#2e2e2e" },
];

export const THEMES: Record<
  ThemeId,
  {
    id: ThemeId;
    name: string;
    tagline: string;
    cost: number;
    sky: [string, string];
    leaf: string;
    stalk: string;
    bean: string;
    paper: string;
    accent: string;
    ink: string;
    dark: boolean;
  }
> = {
  sprout: {
    id: "sprout",
    name: "기본 초록",
    tagline: "매일 자라는 초록",
    cost: 0,
    sky: ["#eef6e8", "#f4efe4"],
    leaf: "#3f8a52",
    stalk: "#61ae72",
    bean: "#8ed14b",
    paper: "#fffdf8",
    accent: "#61ae72",
    ink: "#3d3a36",
    dark: false,
  },
  chick: {
    id: "chick",
    name: "데굴데굴 병아리",
    tagline: "동그란 알에서 더 동그란 병아리가 나왔어요",
    cost: 40,
    sky: ["#fff4cc", "#f7e7a8"],
    leaf: "#d9a441",
    stalk: "#e8c44d",
    bean: "#f3d36b",
    paper: "#fff8e6",
    accent: "#d9a441",
    ink: "#3d3a36",
    dark: false,
  },
  halloween: {
    id: "halloween",
    name: "오싹오싹 호박",
    tagline: "귀여워도 무서운 척 해주세요",
    cost: 50,
    sky: ["#2b241f", "#4a3428"],
    leaf: "#d9783a",
    stalk: "#8a5a32",
    bean: "#ef8a3c",
    paper: "#2f2722",
    accent: "#ef8a3c",
    ink: "#fff8ee",
    dark: true,
  },
  moon: {
    id: "moon",
    name: "둥실둥실 달하늘",
    tagline: "기울었다가도 다시 차오르는 기분 같아요",
    cost: 60,
    sky: ["#1d2740", "#3a4a73"],
    leaf: "#9bb0d9",
    stalk: "#7f93c4",
    bean: "#e8e2c8",
    paper: "#222a40",
    accent: "#c9d4ee",
    ink: "#f4efe4",
    dark: true,
  },
  maple: {
    id: "maple",
    name: "솔솔 단풍",
    tagline: "바람이 한 번 스치면 잎이 내려와요",
    cost: 45,
    sky: ["#f4e4cc", "#d9a06a"],
    leaf: "#c45c28",
    stalk: "#b56a32",
    bean: "#e08a4a",
    paper: "#fff4e8",
    accent: "#c45c28",
    ink: "#3d3a36",
    dark: false,
  },
  lavender: {
    id: "lavender",
    name: "라벤더 낮잠",
    tagline: "잠깐 눈을 감아도 괜찮아요",
    cost: 55,
    sky: ["#eee6f4", "#d9cce8"],
    leaf: "#8d74a8",
    stalk: "#b197c9",
    bean: "#cbb6de",
    paper: "#f7f2fb",
    accent: "#8d74a8",
    ink: "#3d3a36",
    dark: false,
  },
};

export const THEME_LIST = Object.values(THEMES);
export const GITHUB_REPO = "https://github.com/Lukas-park/grok-kong-playground";
