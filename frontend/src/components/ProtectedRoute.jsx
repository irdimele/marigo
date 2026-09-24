import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../api/auth";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  return children;
}
