import client from "./client";

export async function getCart() {
  const res = await client.get("/cart/");
  return res.data;
}

export async function addItem(productId, quantity = 1, color = "", size = "") {
  // Size/color pass through as given. Non-Clothing callers send "".
  // Backend forces size="" when category.has_size_options is false.
  const res = await client.post("/cart/add/", {
    product_id: productId,
    quantity,
    color: color || "",
    size: (size ?? "").trim(),
  });
  return res.data;
}

export async function updateItem(itemId, quantity) {
  const res = await client.patch(`/cart/items/${itemId}/`, { quantity });
  return res.data;
}

export async function removeItem(itemId) {
  await client.delete(`/cart/items/${itemId}/`);
  return true;
}
