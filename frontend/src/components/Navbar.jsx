import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import logo from "../assets/logo.png";
import { useShop } from "../context/ShopContext";
import { getMe, isLoggedIn, logout } from "../api/auth";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About us", to: "/about" },
  { label: "New arrivals", to: "/shop?sort=new" },
  { label: "Best sellers", to: "/shop?sort=best" },
];

// Identical box for all four header icons (search / wishlist / cart / account)
// so they share one vertical baseline, size, and hit area.
const iconBtnClass =
  "relative flex items-center justify-center w-11 h-11 text-gray-900 hover:text-primary transition-colors";

const shopCategories = [
  { label: "BEST SELLERS", to: "/shop?sort=best" },
  { label: "NEW ARRIVALS", to: "/shop?sort=new" },
  { label: "SOUVENIRS", to: "/shop?category=souvenirs" },
  { label: "CLOTHING", to: "/shop?category=clothing" },
  { label: "ACCESSORIES", to: "/shop?category=accessories" },
  { label: "STATIONARY", to: "/shop?category=stationary" },
];

export default function Navbar() {
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const accountRef = useRef(null);
  const mobileAccountRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount, wishlistCount, refreshCart, refreshWishlist } = useShop();
  const authed = isLoggedIn();
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setIsStaff(Boolean(me?.is_staff));
      })
      .catch(() => {
        if (!cancelled) setIsStaff(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-check after login/logout navigation (location changes).
  }, [authed, location]);

  // Hide Dashboard when logged out even if isStaff is briefly stale.
  const showDashboard = authed && isStaff;

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShopOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      const inAccount =
        (accountRef.current && accountRef.current.contains(e.target)) ||
        (mobileAccountRef.current && mobileAccountRef.current.contains(e.target));
      if (!inAccount) setAccountOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setShopOpen(false);
    setMobileOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
    // Re-sync counts after login/logout navigation (Provider is outside the Router).
    refreshCart();
    refreshWishlist();
  }, [location, refreshCart, refreshWishlist]);

  function handleLogout() {
    logout();
    setAccountOpen(false);
    setMobileOpen(false);
    // Wishlist is user-specific -> clear badge; cart falls back to guest session.
    refreshWishlist();
    refreshCart();
    navigate("/");
  }

  const accountMenu = (
    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 shadow-lg rounded-sm py-2 min-w-[160px] z-50">
      {showDashboard && (
        <Link
          to="/dashboard"
          onClick={() => setAccountOpen(false)}
          className="block px-5 py-3 min-h-[44px] flex items-center text-sm font-sans text-gray-900 hover:text-primary hover:bg-gray-50 transition-colors"
        >
          Dashboard
        </Link>
      )}
      <Link
        to="/orders"
        onClick={() => setAccountOpen(false)}
        className="block px-5 py-3 min-h-[44px] flex items-center text-sm font-sans text-gray-900 hover:text-primary hover:bg-gray-50 transition-colors"
      >
        Orders
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="block w-full text-left px-5 py-3 min-h-[44px] text-sm font-sans text-gray-900 hover:text-primary hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Logout
      </button>
    </div>
  );

  function submitSearch(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchQuery(q);
    setSearchOpen(false);
    if (!q) {
      // Clear any stale ?search= so the full catalog renders; keep other filters.
      const next = new URLSearchParams(location.search);
      next.delete("search");
      const qs = next.toString();
      navigate(qs ? `/shop?${qs}` : "/shop");
      return;
    }
    const params = new URLSearchParams();
    params.set("search", q);
    navigate(`/shop?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-0">
      {/* min-h keeps ~80px bar; reduced left padding pulls logo toward the edge; items-center keeps content centered */}
      <div className="max-w-[1400px] mx-auto flex items-center justify-between pl-4 lg:pl-6 pr-6 lg:pr-10 py-4 min-h-[80px]">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <img src={logo} alt="Marigo" className="h-10 object-contain" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[15px] font-sans transition-colors ${
                location.pathname === link.to
                  ? "text-primary font-semibold"
                  : "text-gray-900 hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Shop dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShopOpen((o) => !o)}
              className="flex items-center gap-1 text-[15px] font-sans text-gray-900 hover:text-primary transition-colors cursor-pointer"
            >
              Shop
              <ChevronDown
                size={16}
                className={`transition-transform ${shopOpen ? "rotate-180" : ""}`}
              />
            </button>

            {shopOpen && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 shadow-lg rounded-sm py-3 min-w-[200px] z-50">
                {shopCategories.map((cat) => (
                  <Link
                    key={cat.to}
                    to={cat.to}
                    className="flex items-center min-h-[44px] px-5 py-2 text-sm font-sans text-gray-900 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/contact"
            className="text-[15px] font-sans text-gray-900 hover:text-primary transition-colors"
          >
            Contact us
          </Link>
        </nav>

        {/* Desktop icons */}
        <div className="hidden lg:flex items-center gap-1">
          <div className="relative flex items-center" ref={searchRef}>
            <button
              className={`${iconBtnClass} cursor-pointer`}
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
            >
              <Search size={22} strokeWidth={1.5} />
            </button>
            {searchOpen && (
              <form
                onSubmit={submitSearch}
                className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 shadow-lg rounded-sm flex items-center px-3 py-2"
              >
                <Search size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 min-w-0 ml-2 text-sm font-sans text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="ml-2 text-xs font-sans text-primary font-semibold cursor-pointer"
                >
                  Go
                </button>
              </form>
            )}
          </div>
          <Link
            to="/wishlist"
            className={iconBtnClass}
            aria-label="Wishlist"
          >
            <Heart size={22} strokeWidth={1.5} />
            {wishlistCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-white text-center"
                style={{ backgroundColor: "#E7004C" }}
              >
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            className={iconBtnClass}
            aria-label="Cart"
          >
            <ShoppingBag size={22} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-white text-center"
                style={{ backgroundColor: "#61B0BC" }}
              >
                {cartCount}
              </span>
            )}
          </Link>
          {authed ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className={`${iconBtnClass} cursor-pointer`}
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Account"
                aria-expanded={accountOpen}
              >
                <User size={22} strokeWidth={1.5} />
              </button>
              {accountOpen && accountMenu}
            </div>
          ) : (
            <Link to="/auth" className={iconBtnClass} aria-label="Login">
              <User size={22} strokeWidth={1.5} />
            </Link>
          )}
        </div>

        {/* Mobile: cart + hamburger (cart always visible in collapsed bar) */}
        <div className="lg:hidden flex items-center gap-1">
          <Link to="/cart" className={iconBtnClass} aria-label="Cart">
            <ShoppingBag size={22} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-white text-center"
                style={{ backgroundColor: "#61B0BC" }}
              >
                {cartCount}
              </span>
            )}
          </Link>
          <button
            className="flex items-center justify-center w-11 h-11 text-gray-900 cursor-pointer"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-6 pb-6">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`py-3.5 min-h-[44px] text-base font-sans border-b border-gray-100 flex items-center ${
                  location.pathname === link.to
                    ? "text-primary font-semibold"
                    : "text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile Shop accordion */}
            <div>
              <button
                onClick={() => setShopOpen((o) => !o)}
                className="flex items-center justify-between w-full py-3.5 min-h-[44px] text-base font-sans text-gray-900 border-b border-gray-100 cursor-pointer"
              >
                Shop
                <ChevronDown
                  size={18}
                  className={`transition-transform ${shopOpen ? "rotate-180" : ""}`}
                />
              </button>
              {shopOpen && (
                <div className="pl-4 pb-2">
                  {shopCategories.map((cat) => (
                    <Link
                      key={cat.to}
                      to={cat.to}
                      className="flex items-center min-h-[44px] py-2 text-sm font-sans text-gray-700"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/contact"
              className="py-3.5 min-h-[44px] flex items-center text-base font-sans text-gray-900 border-b border-gray-100"
            >
              Contact us
            </Link>
          </nav>

          {/* Mobile icons */}
          <div className="flex items-center gap-1 mt-4">
            <button
              type="button"
              className={`${iconBtnClass} cursor-pointer`}
              onClick={() => {
                setMobileOpen(false);
                setSearchOpen(true);
              }}
              aria-label="Search"
            >
              <Search size={22} strokeWidth={1.5} />
            </button>
            <Link
              to="/wishlist"
              className={iconBtnClass}
              aria-label="Wishlist"
            >
              <Heart size={22} strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-white text-center"
                  style={{ backgroundColor: "#E7004C" }}
                >
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              className={iconBtnClass}
              aria-label="Cart"
            >
              <ShoppingBag size={22} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-white text-center"
                  style={{ backgroundColor: "#61B0BC" }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
            {authed ? (
              <div className="relative" ref={mobileAccountRef}>
                <button
                  type="button"
                  className={`${iconBtnClass} cursor-pointer`}
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-label="Account"
                  aria-expanded={accountOpen}
                >
                  <User size={22} strokeWidth={1.5} />
                </button>
                {accountOpen && accountMenu}
              </div>
            ) : (
              <Link to="/auth" className={iconBtnClass} aria-label="Login">
                <User size={22} strokeWidth={1.5} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Search panel (mobile) */}
      {searchOpen && !mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-3">
          <form onSubmit={submitSearch} className="flex items-center border-b border-gray-300 pb-2">
            <Search size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 min-w-0 ml-2 text-sm font-sans text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="ml-2 text-xs font-sans text-primary font-semibold cursor-pointer"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
