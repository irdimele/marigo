import { Link } from "react-router-dom";
import { Heart, ArrowLeft } from "lucide-react";

export default function Welcome() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32 flex flex-col items-center text-center animate-[fadeIn_0.3s_ease-out]">
      {/* Filled heart — accent color, no background circle */}
      <Heart
        size={48}
        strokeWidth={1.5}
        className="text-accent mb-5"
        fill="#E7004C"
        color="#E7004C"
        aria-hidden="true"
      />

      <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
        Thank You for Registering!
      </h1>

      <p className="font-sans text-sm text-gray-500 leading-relaxed max-w-[400px] mb-8">
        Lorem ipsum dolor sit amet, tantas ipsum dolor gubegren inciderint no
        his.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-sans text-primary hover:opacity-80 transition-opacity"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back Home
      </Link>
    </div>
  );
}
