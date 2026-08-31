import { ko } from "$lib/i18n";

export type NavItem = {
  label: string;
  href: string;
};

export const primaryNavigation: NavItem[] = [
  { label: ko.nav.home, href: "/" },
  { label: "플레이어 검색", href: "/players" },
];
