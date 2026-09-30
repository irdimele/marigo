import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import heroBg from "../assets/hero backround.png";

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 50;

// Text-only slides — hero image is static (does not rotate).
// TODO(copy): Placeholder headings/links — replace with real promo copy + destinations later.
const textSlides = [
  { heading: "Summer Essentials", cta: "Shop Now", to: "/shop" },
  { heading: "New Product Collection", cta: "Shop Now", to: "/shop" },
  { heading: "Handpicked Gifts", cta: "Shop Now", to: "/shop" },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touching, setTouching] = useState(false);
  // Bumped on dot taps so auto-advance restarts even when the active dot is tapped.
  const [autoplayReset, setAutoplayReset] = useState(0);
  const touchStartX = useRef(null);

  function prev() {
    setCurrent((c) => (c === 0 ? textSlides.length - 1 : c - 1));
  }
  function next() {
    setCurrent((c) => (c === textSlides.length - 1 ? 0 : c + 1));
  }

  // Auto-play: depends on `current` so any manual arrow click restarts the timer.
  // Pauses on desktop hover and while the user is touching (mobile swipe).
  useEffect(() => {
    if (paused || touching || textSlides.length < 2) return undefined;
    const id = setInterval(() => {
      setCurrent((c) => (c === textSlides.length - 1 ? 0 : c + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, touching, current, autoplayReset]);

  // Swipe on the text block (mobile): 50px threshold, left = next, right = prev.
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    setTouching(true);
  }
  function handleTouchEnd(e) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    setTouching(false);
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx > 0) prev();
    else next();
  }

  const slide = textSlides[current];

  return (
    <section
      className="relative w-full md:h-[85vh] overflow-hidden bg-[#f0f0f0]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Static hero image — never advances with the text carousel.
          Mobile: 4:3 block at the top, object-left keeps both tote bags in frame.
          Desktop: absolute fill, centered exactly as before. */}
      <div className="relative w-full aspect-[4/3] overflow-hidden md:absolute md:inset-0 md:aspect-auto">
        <img
          src={heroBg}
          alt="New collection"
          className="absolute inset-0 w-full h-full object-cover object-left md:object-center border-0 outline-none"
        />
      </div>

      {/* Desktop carousel arrows — same absolute overlay as before, hidden on mobile */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="hidden md:flex absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-white/70 hover:bg-white rounded-full text-gray-700 transition-colors z-10 cursor-pointer"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="hidden md:flex absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-white/70 hover:bg-white rounded-full text-gray-700 transition-colors z-10 cursor-pointer"
      >
        <ChevronRight size={24} />
      </button>

      {/* Text block: static, below the photo on mobile; absolute right panel on desktop */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col items-center justify-center px-4 py-6 text-center bg-white md:absolute md:right-0 md:top-0 md:h-full md:w-[45%] md:items-start md:py-0 md:pl-12 md:pr-16 md:bg-transparent md:text-left"
      >
        <div key={current} className="animate-[textSwap_0.45s_ease-out] flex flex-col items-center md:items-start">
          <h1 className="font-display text-2xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-snug md:leading-tight mb-6 md:mb-8 text-center md:text-left line-clamp-2 md:line-clamp-none">
            {slide.heading}
          </h1>
          <Link
            to={slide.to}
            className="inline-flex items-center justify-center px-5 py-2 border-2 border-primary text-primary font-sans text-sm font-semibold rounded-md hover:bg-primary hover:text-white transition-colors md:text-base md:px-8 md:py-3"
          >
            {slide.cta}
          </Link>
        </div>

        {/* Mobile controls: dots only, in flow under the button — arrows are
            desktop-only (hidden md:flex above) and swipe still works */}
        <div className="flex items-center justify-center mt-6 md:hidden">
          {textSlides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrent(i);
                setAutoplayReset((n) => n + 1);
              }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
              className="w-6 h-6 flex items-center justify-center cursor-pointer focus:outline-none"
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-primary" : "bg-gray-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
