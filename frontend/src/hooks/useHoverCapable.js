import { useEffect, useState } from "react";

const HOVER_CAPABLE_QUERY = "(hover: hover) and (pointer: fine)";

function readInitial() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(HOVER_CAPABLE_QUERY).matches;
}

export function useHoverCapable() {
  // Initial value read synchronously during the first render.
  const [hoverCapable, setHoverCapable] = useState(readInitial);

  useEffect(() => {
    const mql = window.matchMedia(HOVER_CAPABLE_QUERY);
    function onChange(event) {
      setHoverCapable(event.matches);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return hoverCapable;
}
