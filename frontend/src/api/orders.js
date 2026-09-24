import client from "./client";

export async function checkout(payload = {}) {
  const res = await client.post("/checkout/", payload);
  return res.data;
}

function normalizeList(data) {
  if (Array.isArray(data)) return { results: data, count: data.length };
  return data;
}

export async function getOrders() {
  const res = await client.get("/orders/");
  return normalizeList(res.data);
}
