import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import FormInput from "../components/FormInput";
import { login, register } from "../api/auth";

const tabs = ["Login", "Register"];

export default function Auth() {
  const [tab, setTab] = useState("Login");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Client-side validation errors
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const location = useLocation();

  function switchTab(next) {
    setTab(next);
    setErrors({});
    setServerError("");
  }

  function validateLogin() {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    return errs;
  }

  function validateRegister() {
    const errs = {};
    if (!regName.trim()) errs.regName = "Full name is required.";
    else if (regName.trim().length < 2) errs.regName = "Name is too short.";
    if (!regEmail.trim()) errs.regEmail = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail))
      errs.regEmail = "Enter a valid email address.";
    if (!regPassword) errs.regPassword = "Password is required.";
    else if (regPassword.length < 8)
      errs.regPassword = "Password must be at least 8 characters.";
    if (!regConfirm) errs.regConfirm = "Please confirm your password.";
    else if (regConfirm !== regPassword)
      errs.regConfirm = "Passwords do not match.";
    return errs;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setServerError("");
    const errs = validateLogin();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password, remember);
      // Honor ProtectedRoute/StaffRoute redirect target (e.g. /dashboard).
      navigate(location.state?.from || "/");
    } catch (err) {
      const data = err?.response?.data;
      setServerError(
        data?.detail ||
          (data ? Object.values(data).flat().join(" ") : "") ||
          `Login failed: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setServerError("");
    const errs = validateRegister();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await register(regName.trim(), regEmail.trim(), regPassword);
      navigate("/welcome");
    } catch (err) {
      const data = err?.response?.data;
      setServerError(
        data
          ? Object.values(data).flat().join(" ")
          : `Registration failed: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 animate-[fadeIn_0.3s_ease-out]">
      <div className="max-w-md mx-auto">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 pb-3 text-lg font-display font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
                tab === t
                  ? "text-primary border-primary"
                  : "text-gray-400 border-transparent hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {serverError && (
          <p
            role="alert"
            className="text-accent text-sm font-sans mb-5 bg-accent/5 border border-accent/20 rounded-md px-4 py-3"
          >
            {serverError}
          </p>
        )}

        {tab === "Login" ? (
          <form onSubmit={handleLogin} className="space-y-6" noValidate>
            <FormInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              placeholder="Enter your email"
            />
            <div className="relative">
              <FormInput
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-0 bottom-1 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-primary transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 min-h-[44px] text-sm font-sans text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-primary w-5 h-5 cursor-pointer"
                />
                Remember me
              </label>
              <button
                type="button"
                className="min-h-[44px] px-1 text-sm font-sans text-primary hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-sans text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Logging in…" : "Login"}
            </button>

            <p className="text-center text-sm font-sans text-gray-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchTab("Register")}
                className="min-h-[44px] px-1 text-primary font-semibold hover:underline cursor-pointer"
              >
                Register
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6" noValidate>
            <FormInput
              label="Full name"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              error={errors.regName}
              autoComplete="name"
              placeholder="Enter your full name"
            />
            <FormInput
              label="Email"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              error={errors.regEmail}
              autoComplete="email"
              placeholder="Enter your email"
            />
            <div className="relative">
              <FormInput
                label="Password"
                type={showPassword ? "text" : "password"}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                error={errors.regPassword}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-0 bottom-1 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-primary transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FormInput
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              error={errors.regConfirm}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-sans text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-sm font-sans text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchTab("Login")}
                className="min-h-[44px] px-1 text-primary font-semibold hover:underline cursor-pointer"
              >
                Login
              </button>
            </p>
          </form>
        )}

        <p className="text-center mt-8 text-sm font-sans">
          <Link to="/" className="text-gray-400 hover:text-primary transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
