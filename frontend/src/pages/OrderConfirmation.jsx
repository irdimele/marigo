import { Link, useSearchParams } from "react-router-dom";
import { Heart, ArrowLeft } from "lucide-react";

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32 flex flex-col items-center text-center animate-[fadeIn_0.3s_ease-out]">
      <Heart
        size={48}
        strokeWidth={1.5}
        className="text-accent mb-5"
        fill="#E7004C"
        color="#E7004C"
        aria-hidden="true"
      />

      <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
        Thank You For Your Order!
      </h1>

      <p className="font-sans text-sm text-gray-500 leading-relaxed max-w-[420px] mb-3">
        Thank you so much for your order. We can&apos;t wait for you to receive
        it — a confirmation email is on its way to your inbox.
      </p>

      {orderId && (
        <p className="font-sans text-sm text-gray-900 font-semibold mb-8">
          Order #{orderId}
        </p>
      )}

      {!orderId && <div className="mb-8" />}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-sans text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back Home
        </Link>
        <Link
          to="/orders"
          className="text-sm font-sans text-primary hover:opacity-80 transition-opacity"
        >
          View my orders
        </Link>
      </div>
    </div>
  );
}
