import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { getProduct } from "../api/products";
import { getAccessToken } from "../api/auth";
import { useShop } from "../context/ShopContext";
import { ProductDetailSkeleton } from "../components/Skeleton";

const sizes = ["XS", "S", "M", "L", "XL"];
const colors = [
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
];

/** Explicit White-first default; fall back to first available if White is absent. */
function defaultColorIndex(list) {
  const white = list.findIndex((c) => c.name.toLowerCase() === "white");
  return white >= 0 ? white : 0;
}

function apiDetail(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  return Object.values(data).flat().join(" ");
}

const lorem =
  "Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud.";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isWished, toggleWishlist: toggleWishlistCtx, addToCart } = useShop();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(defaultColorIndex(colors));
  const [selectedSize, setSelectedSize] = useState("M");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  // Single API call — breadcrumb, title, price, description, images all
  // derive from this single product object so they can never mismatch.
  useEffect(() => {
    let cancelled = false;
    getProduct(slug)
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        setActiveImage(0);
        setSelectedColor(defaultColorIndex(colors));
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data
            ? `Failed to load product: ${JSON.stringify(err.response.data)}`
            : `Failed to load product: ${err.message}`
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function toggleWishlist() {
    if (!getAccessToken()) {
      navigate("/auth");
      return;
    }
    try {
      await toggleWishlistCtx(product.id);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        navigate("/auth");
      }
    }
  }

  function changeQty(delta) {
    setQty((q) => {
      const stock = Number(product?.stock ?? 0);
      if (stock < 1) return 1;
      const next = (typeof q === "number" ? q : 1) + delta;
      return Math.min(Math.max(1, next), stock);
    });
  }

  async function handleBuyNow() {
    if (outOfStock) return;
    setError("");
    setBuying(true);
    try {
      // Non-clothing categories have color/size disabled — send empty values.
      const colorName = colorEnabled ? colors[selectedColor]?.name || "" : "";
      const sizeName = sizeEnabled ? selectedSize : "";
      await addToCart(product.id, qty, colorName, sizeName);
      navigate("/cart");
    } catch (err) {
      setError(apiDetail(err, "Add to cart failed. Please try again."));
    }
    setBuying(false);
  }

  if (loading) return <ProductDetailSkeleton />;
  if (error && !product)
    return (
      <p role="alert" className="text-center py-20 text-accent">
        Error: {error}
      </p>
    );
  if (!product)
    return (
      <p role="alert" className="text-center py-20 text-accent">
        Error: product not found.
      </p>
    );

  const categoryName = product.category?.name || "Shop";
  const categorySlug = product.category?.slug || "";
  // Category-driven: only Clothing enables the color swatch + size selector.
  const colorEnabled = Boolean(product.category?.has_color_options);
  const sizeEnabled = Boolean(product.category?.has_size_options);
  const stock = Number(product.stock ?? 0);
  const outOfStock = stock < 1;
  const selectedColorName = colors[selectedColor]?.name || "";
  // Color-linked gallery: show only images tagged with the active swatch.
  // No match → fall back to the full set (primary first) so the main image never breaks.
  const allImages = (product.images || []).filter((i) => i.image);
  const colorImages = colorEnabled
    ? allImages.filter(
        (i) => (i.color || "").trim().toLowerCase() === selectedColorName.toLowerCase()
      )
    : allImages;
  const displayImages = colorEnabled && colorImages.length ? colorImages : allImages;
  const imageUrls = displayImages.map((i) => i.image).filter(Boolean);

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 animate-[fadeIn_0.3s_ease-out]">
      {/* Breadcrumb — all segments from the same product object */}
      <nav
        aria-label="Breadcrumb"
        className="text-xs font-sans text-gray-500 mb-8 flex flex-wrap items-center gap-1.5"
      >
        <Link to="/shop" className="hover:text-primary transition-colors">
          Shop
        </Link>
        <span>/</span>
        <Link
          to={`/shop?category=${categorySlug}`}
          className="hover:text-primary transition-colors"
        >
          {categoryName}
        </Link>
        <span>/</span>
        <span className="text-gray-700">{product.name}</span>
      </nav>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-14">
        {/* Left: thumbnail strip + main image */}
        <div className="w-full md:w-[55%] flex gap-4">
          {imageUrls.length > 1 && (
            <div className="flex flex-col gap-3 w-16 lg:w-20 flex-shrink-0">
              {imageUrls.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square bg-[#f0f0f0] overflow-hidden border-2 transition-colors cursor-pointer ${
                    activeImage === i
                      ? "border-primary"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img
                    src={src}
                    alt={`${product.name} thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 aspect-square bg-[#f0f0f0] overflow-hidden">
            {imageUrls[activeImage] ? (
              <img
                src={imageUrls[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                No image
              </div>
            )}
          </div>
        </div>

        {/* Right: details */}
        <div className="w-full md:w-[45%]">
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-gray-900">
            {product.name}
          </h1>

          <p className="text-lg font-sans text-gray-900 mt-3">
            {parseFloat(product.price).toFixed(0)} $
          </p>

          <p className="text-sm font-sans text-gray-600 mt-4 leading-relaxed">
            {product.description || lorem}
          </p>

          {/* Choose Color — active only when category.has_color_options (Clothing) */}
          <div className={`mt-7 ${colorEnabled ? "" : "opacity-50"}`}>
            <p
              className={`text-sm font-sans mb-2.5 ${
                colorEnabled ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Choose Color
            </p>
            <div className="flex gap-2.5">
              {colors.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  disabled={!colorEnabled}
                  onClick={() => {
                    if (!colorEnabled) return;
                    setSelectedColor(i);
                    // Switch gallery to this color's photos (or primary fallback).
                    setActiveImage(0);
                  }}
                  className={`w-11 h-11 flex items-center justify-center transition-shadow ${
                    colorEnabled
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-60"
                  } ${
                    colorEnabled && selectedColor === i
                      ? "border-2 border-gray-900 ring-1 ring-gray-900 ring-offset-1"
                      : "border-2 border-gray-300"
                  }`}
                  title={colorEnabled ? c.name : `${c.name} (not available)`}
                  aria-label={c.name}
                  aria-pressed={colorEnabled && selectedColor === i}
                >
                  <span
                    className="w-6 h-6 rounded-full border border-gray-200"
                    style={{ backgroundColor: c.value }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Choose Size — active only when category.has_size_options (Clothing) */}
          <div className={`mt-5 ${sizeEnabled ? "" : "opacity-50"}`}>
            <p
              className={`text-sm font-sans mb-2.5 ${
                sizeEnabled ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Choose Size
            </p>
            <div className="flex gap-4">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!sizeEnabled}
                  onClick={() => sizeEnabled && setSelectedSize(s)}
                  className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center text-sm font-sans transition-colors ${
                    sizeEnabled
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-60"
                  } ${
                    sizeEnabled && selectedSize === s
                      ? "text-primary font-semibold"
                      : "text-gray-900"
                  } ${sizeEnabled && selectedSize !== s ? "hover:text-primary" : ""}`}
                  title={sizeEnabled ? s : `${s} (not available)`}
                  aria-label={s}
                  aria-pressed={sizeEnabled && selectedSize === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-5">
            <p className="text-sm font-sans text-gray-900 mb-2.5">Quantity</p>
            <div className="inline-flex items-stretch border border-gray-300 rounded-sm">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                disabled={qty <= 1 || outOfStock}
                className="min-w-[44px] min-h-[44px] px-3 py-1.5 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="px-3 min-w-[2.5rem] flex items-center justify-center text-sm font-sans text-gray-900">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => changeQty(1)}
                disabled={outOfStock || qty >= stock}
                className="min-w-[44px] min-h-[44px] px-3 py-1.5 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            {!outOfStock && stock > 0 && stock <= 5 && (
              <p className="text-xs font-sans text-gray-500 mt-1.5">
                Only {stock} left in stock
              </p>
            )}
          </div>

          {/* Buy now + wishlist heart */}
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={buying || outOfStock}
              className="px-10 min-h-[44px] py-2.5 border border-primary text-primary font-sans text-sm font-semibold hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary"
            >
              {buying ? "Adding…" : "Buy now"}
            </button>
            <button
              type="button"
              onClick={toggleWishlist}
              className="w-11 h-11 flex items-center justify-center border border-accent/60 text-accent hover:bg-accent/5 transition-colors cursor-pointer"
              aria-label={isWished(product.id) ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                size={20}
                strokeWidth={1.5}
                style={
                  isWished(product.id)
                    ? { fill: "#E7004C", color: "#E7004C" }
                    : { fill: "none", color: "#E7004C" }
                }
              />
            </button>
            {outOfStock && (
              <p className="text-sm font-sans text-gray-600 w-full" role="status">
                Out of stock
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-accent font-sans" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
