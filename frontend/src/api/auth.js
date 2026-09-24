import client from "./client";

// Cached /auth/me payload so Navbar/StaffRoute share one fetch per session.
let meCache = null;
let mePromise = null;

export function getCachedMe() {
  return meCache;
}

export function clearMe() {
  meCache = null;
  mePromise = null;
}

export async function getMe({ force = false } = {}) {
  if (!force && meCache) return meCache;
  if (!force && mePromise) return mePromise;
  mePromise = client
    .get("/auth/me/")
    .then((res) => {
      meCache = res.data;
      mePromise = null;
      return meCache;
    })
    .catch((err) => {
      mePromise = null;
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        meCache = null;
      }
      throw err;
    });
  return mePromise;
}

function saveTokens(access, refresh, remember = false) {
  if (remember) {
    localStorage.setItem("remember", "1");
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    sessionStorage.removeItem("access");
    sessionStorage.removeItem("refresh");
  } else {
    localStorage.removeItem("remember");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    sessionStorage.setItem("access", access);
    sessionStorage.setItem("refresh", refresh);
  }
}

export function getAccessToken() {
  return (
    localStorage.getItem("access") || sessionStorage.getItem("access") || null
  );
}

export function getRefreshToken() {
  return (
    localStorage.getItem("refresh") || sessionStorage.getItem("refresh") || null
  );
}

function jwtExpired(token) {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function isLoggedIn() {
  const access = getAccessToken();
  if (access && !jwtExpired(access)) return true;
  const refresh = getRefreshToken();
  return Boolean(refresh && !jwtExpired(refresh));
}

export async function login(email, password, remember = false) {
  const res = await client.post("/token/", { email, password });
  const { access, refresh } = res.data;
  saveTokens(access, refresh, remember);
  clearMe();
  return res.data;
}

export async function register(fullName, email, password) {
  const res = await client.post("/auth/register/", {
    full_name: fullName,
    email,
    password,
  });
  // Register endpoint returns user + tokens; keep the session active.
  if (res.data?.access && res.data?.refresh) {
    saveTokens(res.data.access, res.data.refresh, false);
  }
  clearMe();
  return res.data;
}

export function logout() {
  localStorage.removeItem("remember");
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  sessionStorage.removeItem("access");
  sessionStorage.removeItem("refresh");
  clearMe();
}
