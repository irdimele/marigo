import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCart, addItem, updateItem, removeItem } from "../api/cart";
import { getWishlist, addWishlistItem, removeWishlistItem } from "../api/wishlist";
import { isLoggedIn } from "../api/auth";

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const refreshCart = useCallback(async () => {
    try {
      const cart = await getCart();
      setCartCount(cart?.total_items ?? 0);
    } catch {
      setCartCount(0);
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    if (!isLoggedIn()) {
      setWishlistIds(new Set());
      return;
    }
    try {
      const items = await getWishlist();
      setWishlistIds(new Set(items.map((i) => i.product?.id ?? i.product_id)));
    } catch {
      setWishlistIds(new Set());
    }
  }, []);

  useEffect(() => {
    refreshCart();
    refreshWishlist();
  }, [refreshCart, refreshWishlist]);

  async function addToCart(productId, quantity = 1, color = "", size = "") {
    // Size/color pass through as given — non-Clothing callers send "".
    // Backend forces "" when category.has_size_options is false.
    await addItem(productId, quantity, color, size);
    await refreshCart();
  }

  async function changeQty(itemId, quantity) {
    await updateItem(itemId, quantity);
    await refreshCart();
  }

  async function removeFromCart(itemId) {
    await removeItem(itemId);
    await refreshCart();
  }

  async function toggleWishlist(productId) {
    const has = wishlistIds.has(productId);
    // Optimistic update so the badge flips instantly.
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (has) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      if (has) await removeWishlistItem(productId);
      else await addWishlistItem(productId);
    } catch (err) {
      // Revert on failure.
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (has) next.add(productId);
        else next.delete(productId);
        return next;
      });
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        // Caller decides where to redirect.
        throw err;
      }
      throw err;
    }
    await refreshWishlist();
  }

  const value = {
    cartCount,
    wishlistCount: wishlistIds.size,
    isWished: (id) => wishlistIds.has(id),
    addToCart,
    changeQty,
    removeFromCart,
    toggleWishlist,
    refreshCart,
    refreshWishlist,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
