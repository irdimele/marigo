import client from "./client";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

export async function getDashboardOrders() {
  const res = await client.get("/dashboard/orders/");
  return normalizeList(res.data);
}

export async function setDashboardOrderDone(id, isDone) {
  const res = await client.patch(`/dashboard/orders/${id}/`, { is_done: isDone });
  return res.data;
}

export async function getDashboardRevenue(start, end) {
  const res = await client.get("/dashboard/revenue/", { params: { start, end } });
  return res.data;
}

export async function getDashboardMessages() {
  const res = await client.get("/dashboard/messages/");
  return normalizeList(res.data);
}

export async function deleteDashboardMessage(id) {
  const res = await client.delete(`/dashboard/messages/${id}/`);
  return res.data;
}

export async function bulkDeleteDashboardMessages(ids) {
  const res = await client.post("/dashboard/messages/bulk-delete/", { ids });
  return res.data;
}

export async function getDashboardProducts() {
  const res = await client.get("/dashboard/products/");
  return normalizeList(res.data);
}

function productHeaders(data) {
  // FormData → let the browser set multipart boundary.
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return { headers: { "Content-Type": "multipart/form-data" } };
  }
  return {};
}

export async function createDashboardProduct(data) {
  const res = await client.post("/dashboard/products/", data, productHeaders(data));
  return res.data;
}

export async function updateDashboardProduct(id, data) {
  const res = await client.patch(`/dashboard/products/${id}/`, data, productHeaders(data));
  return res.data;
}

export async function deactivateDashboardProduct(id) {
  // Soft-hide only — permanent delete uses deleteDashboardProductHard.
  const fd = new FormData();
  fd.append("is_active", "false");
  const res = await client.patch(`/dashboard/products/${id}/`, fd, productHeaders(fd));
  return res.data;
}

export async function deleteDashboardProductHard(id) {
  // Permanent: removes product + ProductImage rows (OrderItem.product → SET_NULL).
  const res = await client.delete(`/dashboard/products/${id}/`);
  return res.data;
}

export async function deleteDashboardProductImage(productId, imageId) {
  const res = await client.delete(`/dashboard/products/${productId}/images/${imageId}/`);
  return res.data;
}

export async function setDashboardProductPrimaryImage(productId, imageId) {
  const res = await client.patch(
    `/dashboard/products/${productId}/images/${imageId}/set-primary/`
  );
  return res.data;
}

export async function getDashboardCategories() {
  const res = await client.get("/categories/");
  return normalizeList(res.data);
}
