import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getMe, isLoggedIn } from "../api/auth";

export default function StaffRoute({ children }) {
  const location = useLocation();
  const authed = isLoggedIn();
  const [staff, setStaff] = useState(null); // null = loading, true/false after check

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setStaff(Boolean(me?.is_staff));
      })
      .catch(() => {
        if (!cancelled) setStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  if (!authed) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  if (staff === null) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
        <p className="text-gray-500 text-sm font-sans">Loading…</p>
      </div>
    );
  }
  if (!staff) {
    return <Navigate to="/" replace />;
  }
  return children;
}
