import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import heroBg from "../assets/hero backround.png";

const AUTOPLAY_MS = 5000;

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

  function prev() {
    setCurrent((c) => (c === 0 ? textSlides.length - 1 : c - 1));
  }
  function next() {
    setCurrent((c) => (c === textSlides.length - 1 ? 0 : c + 1));
  }

  // Auto-play: depends on `current` so any manual arrow click restarts the timer.
  useEffect(() => {
    if (paused || textSlides.length < 2) return undefined;
    const id = setInterval(() => {
      setCurrent((c) => (c === textSlides.length - 1 ? 0 : c + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, current]);

  const slide = textSlides[current];

  return (
    <section
      className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden bg-[#f0f0f0]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Static hero image — never advances with the text carousel */}
      <img
        src={heroBg}
        alt="New collection"
        className="absolute inset-0 w-full h-full object-cover border-0 outline-none"
      />

      {/* Carousel arrows (text slides) */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-white/70 hover:bg-white rounded-full text-gray-700 transition-colors z-10 cursor-pointer"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-white/70 hover:bg-white rounded-full text-gray-700 transition-colors z-10 cursor-pointer"
      >
        <ChevronRight size={24} />
      </button>

      {/* Text overlaid on right side — only this rotates */}
      <div className="absolute right-0 top-0 h-full w-full md:w-[45%] flex flex-col items-center md:items-start justify-center px-8 md:pr-16 md:pl-12 bg-white/60 md:bg-transparent">
        <div key={current} className="animate-[textSwap_0.45s_ease-out] flex flex-col items-center md:items-start">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-8 text-center md:text-left">
            {slide.heading}
          </h1>
          <Link
            to={slide.to}
            className="inline-block px-8 py-3 border-2 border-primary text-primary font-sans text-base font-semibold rounded-md hover:bg-primary hover:text-white transition-colors"
          >
            {slide.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
