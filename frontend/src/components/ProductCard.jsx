import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Eye, ShoppingCart, Check } from "lucide-react";
import { useHoverCapable } from "../hooks/useHoverCapable";

export default function ProductCard({
  product,
  wished = false,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
}) {
  const [added, setAdded] = useState(false);
  const outOfStock = Number(product?.stock ?? 0) < 1;
  const hoverCapable = useHoverCapable();

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

  const imageBlock = (
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

        {!hoverCapable && onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist(e, product.id);
            }}
            className="absolute bottom-2 left-2 z-20 w-10 h-10 rounded-full bg-white/90 shadow-sm flex items-center justify-center cursor-pointer focus:outline-none"
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={20}
              strokeWidth={1.5}
              style={
                wished
                  ? { fill: "#E7004C", color: "#E7004C" }
                  : { fill: "none", color: "#374151" }
              }
            />
          </button>
        )}

        {!hoverCapable && onAddToCart && (
          <button
            type="button"
            onClick={handleCartClick}
            disabled={outOfStock}
            className={`absolute bottom-2 right-2 z-20 w-10 h-10 rounded-full bg-white/90 shadow-sm flex items-center justify-center transition-colors focus:outline-none ${
              outOfStock
                ? "text-gray-400 cursor-not-allowed opacity-70"
                : added
                  ? "text-primary"
                  : "text-gray-900"
            }`}
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

        {hoverCapable && (
          <div className="block absolute inset-0 bg-black/40 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity flex items-center justify-center gap-4">
            {onQuickView && (
              <div className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickView(product);
                  }}
                  className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center text-primary hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none"
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
                className={`w-11 h-11 rounded-full bg-white flex items-center justify-center transition-colors focus:outline-none ${
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
        )}
      </Link>
    </div>
  );

  if (hoverCapable) {
    return (
      <div className="group block relative focus:outline-none">
        {imageBlock}

        {/* Heart icon (hover-capable layout — sits with the text, as on desktop) */}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist(e, product.id);
            }}
            className="flex absolute bottom-2 right-2 z-20 w-11 h-11 items-center justify-center cursor-pointer focus:outline-none"
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

  return (
    <div className="group block relative focus:outline-none">
      {imageBlock}

      {/* Touch: full-width name row (2 lines reserved), price, stock — no heart here */}
      <div className="mt-3">
        <Link
          to={`/products/${product.slug}`}
          className="focus:outline-none"
        >
          <h3 className="text-sm font-sans text-gray-900 leading-snug hover:text-primary transition-colors line-clamp-2 min-h-10">
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
