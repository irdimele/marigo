import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isLoggedIn } from "../api/auth";
import { getWishlist, removeWishlistItem } from "../api/wishlist";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";

export default function Wishlist() {
  const navigate = useNavigate();
  const { addToCart, refreshWishlist } = useShop();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(() => isLoggedIn());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    getWishlist()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data
              ? `Failed to load wishlist: ${JSON.stringify(err.response.data)}`
              : `Failed to load wishlist: ${err.message}`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(e, productId) {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) =>
      prev.filter((i) => (i.product?.id ?? i.product_id) !== productId)
    );
    try {
      await removeWishlistItem(productId);
      await refreshWishlist();
    } catch {
      getWishlist().then(setItems).catch(() => {});
      await refreshWishlist();
    }
  }

  async function handleAddToCart(e, product) {
    e.preventDefault();
    e.stopPropagation();
    // Quick-add from wishlist: size only for Clothing (has_size_options).
    const size = product?.has_size_options ? "M" : "";
    await addToCart(product.id, 1, "", size);
    navigate("/cart");
  }

  if (!isLoggedIn()) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20 text-center animate-[fadeIn_0.3s_ease-out]">
        <h1 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-4">
          Favourites
        </h1>
        <p className="text-gray-600 mb-8">
          Please sign in to view and save your favourites.
        </p>
        <Link
          to="/auth"
          className="inline-block bg-primary text-white font-sans text-sm px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
      <h1 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-10 text-center">
        Favourites
      </h1>

      {loading ? (
        <ProductGridSkeleton count={4} />
      ) : error ? (
        <p className="text-center text-accent py-10">{error}</p>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-6">
            Your wishlist is empty. Tap the heart on any product to save it here.
          </p>
          <Link
            to="/shop"
            className="inline-block bg-primary text-white font-sans text-sm px-8 py-3 hover:opacity-90 transition-opacity"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const product = item.product;
            if (!product) return null;
            return (
              <ProductCard
                key={item.id}
                product={product}
                wished
                onToggleWishlist={handleRemove}
                onAddToCart={handleAddToCart}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
