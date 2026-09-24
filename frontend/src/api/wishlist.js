import client from "./client";

export async function getWishlist() {
  const res = await client.get("/wishlist/");
  return Array.isArray(res.data) ? res.data : res.data.results || [];
}

export async function addWishlistItem(productId) {
  const res = await client.post("/wishlist/", { product_id: productId });
  return res.data;
}

export async function removeWishlistItem(productId) {
  await client.delete(`/wishlist/${productId}/`);
  return true;
}
