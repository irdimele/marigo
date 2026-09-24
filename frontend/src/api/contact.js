import client from "./client";

export async function sendContactMessage({ name, email, message }) {
  const res = await client.post("/contact/", { name, email, message });
  return res.data;
}
