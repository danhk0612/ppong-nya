import { GameMode } from "../data/types";
import dayjs from "dayjs";

const domain =
  sessionStorage.getItem("overrideDomain") || localStorage.getItem("overrideDomain") || window.location.hostname;

const PPONG_NYA_DOMAIN = "ppong-nya.mydepot.kr";

export const CONFIGURATIONS = {
  DEFAULT: {
    apiSuffix: process.env.NODE_ENV === "development" ? "api-test/v2/pl4/" : "api/v2/pl4/",
    features: {
      ranking: [GameMode.王座, GameMode.玉, GameMode.玉东] as GameMode[] | false,
      statistics: true,
      estimatedStableLevel: true,
      contestTools: false,
      statisticsSubPages: {
        rankBySeat: true,
        dataByRank: [GameMode.王座, GameMode.玉, GameMode.金, GameMode.王东, GameMode.玉东, GameMode.金东] as
          | GameMode[]
          | false,
        fanStats: true,
        numPlayerStats: true,
      },
      aiReview: true,
    },
    table: {
      showGameMode: true,
    },
    availableModes: [GameMode.王座, GameMode.玉, GameMode.金, GameMode.王东, GameMode.玉东, GameMode.金东],
    modePreference: [GameMode.王座, GameMode.玉, GameMode.王东, GameMode.玉东, GameMode.金, GameMode.金东],
    dateMin: dayjs("2019-08-23", "YYYY-MM-DD"),
    siteTitle: "퐁냐",
    packageName: "ppong-nya",
    canonicalDomain: PPONG_NYA_DOMAIN,
    showTopNotice: true,
    mirrorUrl: "https://ppong-nya.mydepot.kr/",
    rootClassName: "ppong-nya",
    rankColors: ["#ec4899", "#8b5cf6", "#0ea5e9", "#f97316"],
    maskedGameLink: true,
  },
  contest: {
    apiSuffix: "api/contest/",
    features: {
      ranking: false as const,
      rankingGroups: null,
      statistics: true,
      estimatedStableLevel: false,
      contestTools: true,
      statisticsSubPages: {
        rankBySeat: true,
        dataByRank: false as const,
        fanStats: true,
        numPlayerStats: false,
      },
      aiReview: false,
    },
    table: {
      showGameMode: true,
    },
    availableModes: [],
    canonicalDomain: domain,
    showTopNotice: false,
    maskedGameLink: false,
  },
};

type Configuration = typeof CONFIGURATIONS.DEFAULT;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeDeep<T extends { [key: string]: any }>(...objects: Partial<T>[]): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isObject = <T>(obj: T) => obj && typeof obj === "object" && (obj as any).constructor === Object;

  return objects.reduce((prev: T, obj: Partial<T>) => {
    Object.keys(obj).forEach((key: keyof T) => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prev[key] = oVal as any;
      } else if (isObject(pVal) && isObject(oVal)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prev[key] = mergeDeep(pVal, oVal as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prev[key] = oVal as any;
      }
    });

    return prev;
  }, {} as T) as T;
}

const ConfBase: Partial<Configuration> = (() => {
  const contestMatch = /^([^.]+)\.contest\./i.exec(domain);
  if (contestMatch) {
    return { ...CONFIGURATIONS.contest, apiSuffix: `api/contest/${contestMatch[1]}/` };
  }
  return CONFIGURATIONS.DEFAULT;
})();

const Conf = mergeDeep<Configuration>(CONFIGURATIONS.DEFAULT, ConfBase);

document.documentElement.className += " " + Conf.rootClassName;

export function canTrackUser() {
  return window.location.host === Conf.canonicalDomain;
}

export default Conf;
