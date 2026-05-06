export type NavItem = {
  label: string;
  href: string;
};

export const primaryNavigation: NavItem[] = [
  { label: "홈", href: "/" },
  { label: "랭킹", href: "#ranking" },
  { label: "전적", href: "#records" },
  { label: "도구", href: "#tools" }
];
