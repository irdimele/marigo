import { useState } from "react";
import { X } from "lucide-react";
import { useShop } from "../context/ShopContext";

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

export default function QuickViewModal({ product, onClose }) {
  // Parent mounts with key={product.id} so state re-inits per product (no setState-in-effect).
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(defaultColorIndex(colors));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const { addToCart } = useShop();

  // Category-driven: list payload carries has_*_options (flat) or nested category.
  const colorEnabled = Boolean(
    product?.has_color_options ?? product?.category?.has_color_options
  );
  const sizeEnabled = Boolean(
    product?.has_size_options ?? product?.category?.has_size_options
  );

  if (!product) return null;

  const stock = Number(product.stock ?? 0);
  const outOfStock = stock < 1;

  async function handleAddToCart() {
    if (outOfStock) return;
    setError("");
    setAdding(true);
    try {
      // Non-clothing categories have color/size disabled — send empty values.
      const colorName = colorEnabled ? colors[selectedColor]?.name || "" : "";
      const sizeName = sizeEnabled ? selectedSize : "";
      await addToCart(product.id, 1, colorName, sizeName);
    } catch (err) {
      const data = err?.response?.data;
      setError(
        (data && (data.detail || Object.values(data).flat().join(" "))) ||
          "Could not add to cart. Please try again."
      );
    }
    setAdding(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-[700px] max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col md:flex-row md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — top-right, always reachable on mobile */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-[101] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Image */}
        <div className="w-full md:w-1/2 bg-[#f0f0f0] aspect-square md:aspect-auto">
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              No image
            </div>
          )}
        </div>

        {/* Details */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-center">
          <h2 className="font-display text-2xl font-bold text-gray-900 pr-10">
            {product.name}
          </h2>
          <p className="text-lg font-sans text-gray-900 mt-2">
            {parseFloat(product.price).toFixed(0)} $
          </p>
          <p className="text-sm font-sans text-gray-500 mt-3 leading-relaxed">
            Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam.
          </p>

          {/* Choose Color — active only when has_color_options (Clothing) */}
          <div className={`mt-5 ${colorEnabled ? "" : "opacity-50"}`}>
            <p
              className={`text-sm font-sans font-semibold mb-2 ${
                colorEnabled ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Choose Color
            </p>
            <div className="flex gap-2">
              {colors.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  disabled={!colorEnabled}
                  onClick={() => colorEnabled && setSelectedColor(i)}
                  className={`w-11 h-11 flex items-center justify-center rounded-full border-2 ${
                    colorEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  } ${
                    colorEnabled && selectedColor === i
                      ? "border-primary"
                      : "border-gray-300"
                  }`}
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

          {/* Choose Size — active only when has_size_options (Clothing) */}
          <div className={`mt-4 ${sizeEnabled ? "" : "opacity-50"}`}>
            <p
              className={`text-sm font-sans font-semibold mb-2 ${
                sizeEnabled ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Choose Size
            </p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!sizeEnabled}
                  onClick={() => sizeEnabled && setSelectedSize(s)}
                  className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center text-sm font-sans ${
                    sizeEnabled
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-60"
                  } ${
                    sizeEnabled && selectedSize === s
                      ? "text-primary font-semibold"
                      : "text-gray-900"
                  }`}
                  title={sizeEnabled ? s : `${s} (not available)`}
                  aria-label={s}
                  aria-pressed={sizeEnabled && selectedSize === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Add to Card */}
          <button
            onClick={handleAddToCart}
            disabled={adding || outOfStock}
            className="mt-6 inline-flex items-center justify-center min-h-[44px] px-8 py-3 border-2 border-primary text-primary font-sans text-sm font-semibold rounded-md hover:bg-primary hover:text-white transition-colors self-start disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary"
          >
            {adding ? "Adding…" : "Add to Card"}
          </button>
          {outOfStock && (
            <p className="mt-2 text-sm font-sans text-gray-600" role="status">
              Out of stock
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-sans text-accent" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
