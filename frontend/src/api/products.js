import client from "./client";

function normalizeList(data) {
  // DRF pagination returns { results: [...] }; plain lists return [...].
  if (Array.isArray(data)) return { results: data, count: data.length };
  return data;
}

export async function getProducts(filters = {}) {
  const res = await client.get("/products/", { params: filters });
  return normalizeList(res.data);
}

export async function getProduct(slugOrId) {
  const res = await client.get(`/products/${slugOrId}/`);
  return res.data;
}
