export function triggerRelayout() {
  requestAnimationFrame(() => window.dispatchEvent(new UIEvent("resize")));
  setTimeout(function () {
    window.dispatchEvent(new UIEvent("resize"));
  }, 200);
}

export function scrollToTop() {
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatPercent = (x: any) => {
  if (!x) {
    return "0%";
  }
  if (x < 0.0001) {
    return "<0.01%";
  }
  return `${(x * 100).toFixed(2)}%`;
};

export const formatFixed3 = (x: number) => x.toFixed(3);
export const formatRound = (x: number) => Math.round(x).toString();
export const formatIdentity = (x: number) => x.toString();

export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
