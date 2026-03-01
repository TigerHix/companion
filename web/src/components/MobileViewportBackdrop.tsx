import { useEffect, useState, useSyncExternalStore } from "react";

function useIsTouchViewport() {
  return useSyncExternalStore(
    () => () => {},
    () =>
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
      && window.innerWidth < 1024,
    () => false,
  );
}

function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // VisualViewport excludes the on-screen keyboard. Account for offsetTop too,
      // which can change while the viewport is being shifted by Safari.
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(covered);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return inset;
}

export function MobileViewportBackdrop() {
  const isTouchViewport = useIsTouchViewport();
  const keyboardInset = useKeyboardInset();

  if (!isTouchViewport || keyboardInset === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 pointer-events-none bg-background"
      style={{ height: `${keyboardInset}px` }}
    />
  );
}
