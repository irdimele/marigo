import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCart } from "../api/cart";
import { useShop } from "../context/ShopContext";
import { CartSkeleton } from "../components/Skeleton";

const SHIPPING_COST = 5;

function formatPrice(value) {
  return `${parseFloat(value).toFixed(0)}$`;
}

function apiDetail(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  return Object.values(data).flat().join(" ");
}

function stockWarning(item) {
  if (!item.product) return null;
  const stock = Number(item.product.stock ?? 0);
  if (stock < 1) return "Out of stock";
  if (item.quantity > stock) return `Only ${stock} left in stock`;
  return null;
}

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { changeQty, removeFromCart, refreshCart } = useShop();

  async function load() {
    setLoading(true);
    setError("");
    try {
      setCart(await getCart());
    } catch (err) {
      setError(
        err?.response?.data
          ? `Failed to load cart: ${JSON.stringify(err.response.data)}`
          : `Failed to load cart: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdate(id, quantity) {
    if (quantity < 1) return;
    setError("");
    try {
      await changeQty(id, Number(quantity));
      setCart(await getCart());
    } catch (err) {
      setError(apiDetail(err, "Update failed. Please try again."));
      // Refresh so the UI reflects current server stock.
      try {
        setCart(await getCart());
      } catch {
        /* keep prior cart state */
      }
    }
  }

  async function handleRemove(id) {
    setError("");
    try {
      await removeFromCart(id);
      setCart(await getCart());
    } catch (err) {
      setError(`Remove failed: ${err.message}`);
      await refreshCart();
    }
  }

  async function handleCheckout() {
    setError("");
    // Guests can check out — billing form on the next step is the contact record.
    navigate("/checkout");
  }

  if (loading) return <CartSkeleton />;
  if (error && !cart)
    return (
      <p role="alert" className="text-center py-20 text-accent">
        Error: {error}
      </p>
    );

  const items = cart?.items || [];
  const itemCount = cart?.total_items ?? 0;
  const subtotal = parseFloat(cart?.total_amount || 0);
  const total = items.length ? subtotal + SHIPPING_COST : 0;

  // Empty cart state
  if (!items.length) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 text-center animate-[fadeIn_0.3s_ease-out]">
        <h2 className="font-display text-3xl font-semibold text-gray-900 mb-4">
          Shopping Cart
        </h2>
        <p className="text-gray-500 font-sans mb-8">
          Your cart is empty.
        </p>
        <Link
          to="/shop"
          className="inline-block bg-primary text-white font-sans text-sm px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Continue shopping
        </Link>
        {error && (
          <p className="text-accent mt-4" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
        {/* Left: cart items */}
        <div>
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="font-display text-3xl font-semibold text-gray-900">
              Shopping Cart
            </h2>
            <p className="text-sm font-sans font-semibold text-gray-900">
              {itemCount} Item{itemCount === 1 ? "" : "s"}
            </p>
          </div>

          {error && (
            <p className="text-accent mb-4" role="alert">
              {error}
            </p>
          )}

          {/* Desktop: table | Mobile: stacked cards */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm font-sans text-gray-900">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="pb-3 pr-4 font-semibold">Product Details</th>
                  <th className="pb-3 pr-4 font-semibold">Quantity</th>
                  <th className="pb-3 pr-4 font-semibold">Price</th>
                  <th className="pb-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const stockNum = Number(item.product?.stock ?? 0);
                  const hasProduct = Boolean(item.product);
                  const oos = hasProduct && stockNum < 1;
                  const warning = stockWarning(item);
                  const canIncrease = !oos && (!hasProduct || item.quantity < stockNum);
                  return (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    {/* Product */}
                    <td className="py-5 pr-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-[#f0f0f0] flex-shrink-0 overflow-hidden">
                          {item.product?.primary_image ? (
                            <img
                              src={item.product.primary_image}
                              alt={item.product?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/products/${item.product?.slug || ""}`}
                            className="text-sm text-gray-900 hover:text-primary transition-colors leading-snug"
                          >
                            {item.product?.name || `Product ${item.product}`}
                          </Link>
                          {(item.color || item.size) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {[item.color, item.size].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {warning && (
                            <p
                              className="text-xs font-sans text-gray-600 mt-1"
                              role="status"
                            >
                              {warning}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Quantity + Remove */}
                    <td className="py-5 pr-4">
                      <div className="inline-flex items-stretch border border-gray-300 rounded-sm">
                        <button
                          type="button"
                          onClick={() => handleUpdate(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="min-w-[44px] min-h-[44px] px-2.5 py-1 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="px-2 min-w-[2ch] flex items-center justify-center text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdate(item.id, item.quantity + 1)}
                          disabled={!canIncrease}
                          className="min-w-[44px] min-h-[44px] px-2.5 py-1 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="mt-2 min-h-[44px] px-2 text-xs text-accent hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-5 pr-4">{formatPrice(item.unit_price)}</td>

                    {/* Total */}
                    <td className="py-5">{formatPrice(item.line_total)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked card rows (no horizontal scroll) */}
          <div className="md:hidden space-y-4">
            {items.map((item) => {
              const stockNum = Number(item.product?.stock ?? 0);
              const hasProduct = Boolean(item.product);
              const oos = hasProduct && stockNum < 1;
              const warning = stockWarning(item);
              const canIncrease = !oos && (!hasProduct || item.quantity < stockNum);
              return (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 bg-[#f0f0f0] flex-shrink-0 overflow-hidden">
                    {item.product?.primary_image ? (
                      <img
                        src={item.product.primary_image}
                        alt={item.product?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${item.product?.slug || ""}`}
                      className="text-sm text-gray-900 hover:text-primary transition-colors leading-snug block"
                    >
                      {item.product?.name || `Product ${item.product}`}
                    </Link>
                    {(item.color || item.size) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {[item.color, item.size].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Unit {formatPrice(item.unit_price)}
                    </p>
                    {warning && (
                      <p className="text-xs font-sans text-gray-600 mt-1" role="status">
                        {warning}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="inline-flex items-stretch border border-gray-300 rounded-sm">
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="min-w-[44px] min-h-[44px] px-2.5 py-1 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-2 min-w-[2ch] flex items-center justify-center text-center text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.id, item.quantity + 1)}
                      disabled={!canIncrease}
                      className="min-w-[44px] min-h-[44px] px-2.5 py-1 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="min-h-[44px] px-2 text-xs text-accent hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      Remove
                    </button>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatPrice(item.line_total)}
                    </span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <Link
            to="/shop"
            className="inline-flex items-center gap-2 mt-8 text-sm font-sans text-primary hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Continue shopping
          </Link>
        </div>

        {/* Right: order summary */}
        <aside className="border border-gray-200 p-6 h-fit">
          <h3 className="font-display text-xl font-semibold text-gray-900 mb-6">
            Order Summary
          </h3>

          <div className="flex items-center justify-between text-sm font-sans text-gray-900 mb-3">
            <span className="uppercase tracking-wide">
              Items: {itemCount}
            </span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-sm font-sans text-gray-900 mb-5">
            <span className="uppercase tracking-wide">Shipping</span>
            <span>{formatPrice(SHIPPING_COST)}</span>
          </div>

          <hr className="border-gray-200 mb-5" />

          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-sans font-bold text-gray-900 uppercase tracking-wide">
              Total Cost
            </span>
            <span className="text-sm font-sans font-bold text-gray-900">
              {formatPrice(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="w-full bg-primary text-white font-sans text-sm font-semibold py-3 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Checkout
          </button>
        </aside>
      </div>
    </div>
  );
}
