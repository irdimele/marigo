import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Eye, ShoppingCart, Check } from "lucide-react";

export default function ProductCard({
  product,
  wished = false,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
}) {
  const [added, setAdded] = useState(false);
  const outOfStock = Number(product?.stock ?? 0) < 1;

  async function handleCartClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!onAddToCart || added || outOfStock) return;
    try {
      await onAddToCart(e, product);
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    } catch {
      // Parent surfaces errors; avoid silent UI lock-up.
    }
  }

  return (
    <div className="group block relative focus:outline-none">
      <div className="relative bg-[#f0f0f0] aspect-square overflow-hidden focus:outline-none">
        <Link
          to={`/products/${product.slug}`}
          className="block w-full h-full focus:outline-none"
        >
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              No image
            </div>
          )}
        </Link>

        {/* Hover overlay: always visible on touch (below md); hover reveal on desktop */}
        <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none">
          {onQuickView && (
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(product);
                }}
                className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center text-primary hover:bg-gray-100 transition-colors cursor-pointer pointer-events-auto focus:outline-none"
                aria-label="Quick view"
              >
                <Eye size={20} strokeWidth={1.5} />
              </button>
              {/* Label sits under the eye button, not the cart */}
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white text-gray-900 text-xs font-sans px-3 py-1 rounded-full shadow-sm whitespace-nowrap pointer-events-none">
                Quick view
              </span>
            </div>
          )}
          {onAddToCart && (
            <button
              type="button"
              onClick={handleCartClick}
              disabled={outOfStock}
              className={`w-11 h-11 rounded-full bg-white flex items-center justify-center transition-colors pointer-events-auto focus:outline-none ${
                outOfStock
                  ? "text-gray-400 cursor-not-allowed opacity-70"
                  : added
                    ? "text-primary cursor-pointer"
                    : "text-gray-900 hover:bg-gray-100 cursor-pointer"
              } ${added && !outOfStock ? "scale-110" : ""} transition-transform`}
              aria-label={
                outOfStock
                  ? "Out of stock"
                  : added
                    ? "Added to cart"
                    : "Add to cart"
              }
            >
              {added && !outOfStock ? (
                <Check size={20} strokeWidth={2} />
              ) : (
                <ShoppingCart size={20} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Heart icon */}
      {onToggleWishlist && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist(e, product.id);
          }}
          className="absolute bottom-2 right-2 z-20 w-11 h-11 flex items-center justify-center cursor-pointer focus:outline-none"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            size={22}
            strokeWidth={1.5}
            style={
              wished
                ? { fill: "#E7004C", color: "#E7004C" }
                : { fill: "none", color: "#374151" }
            }
          />
        </button>
      )}

      {/* Text */}
      <div className="mt-3">
        <Link
          to={`/products/${product.slug}`}
          className="focus:outline-none"
        >
          <h3 className="text-sm font-sans text-gray-900 leading-snug hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm font-sans text-gray-900 mt-1">
          {parseFloat(product.price).toFixed(0)} $
        </p>
        {outOfStock && (
          <p className="text-xs font-sans text-gray-500 mt-0.5" role="status">
            Out of stock
          </p>
        )}
      </div>
    </div>
  );
}
