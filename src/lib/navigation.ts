import { ko } from "$lib/i18n";

export type NavItem = {
  label: string;
  href: string;
};

export const primaryNavigation: NavItem[] = [
  { label: ko.nav.home, href: "/" },
  { label: "플레이어", href: "/players" },
  { label: ko.nav.ranking, href: "#ranking" },
  { label: ko.nav.records, href: "/records" },
  { label: ko.nav.tools, href: "#tools" },
];
