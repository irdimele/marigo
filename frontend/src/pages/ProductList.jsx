import { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getProducts } from "../api/products";
import { getAccessToken } from "../api/auth";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";
import { ProductGridSkeleton } from "../components/Skeleton";

const categories = [
  "ALL",
  "BEST SELLERS",
  "NEW ARRIVALS",
  "SOUVENIRS",
  "CLOTHING",
  "ACCESSORIES",
  "STATIONARY",
];

const ORDERING_MAP = {
  price_desc: "-price",
  price_asc: "price",
  newest: "-created_at",
  oldest: "created_at",
  best: "-is_best_seller,-created_at",
};

function tabFromSearch(params) {
  const sort = params.get("sort");
  if (sort === "best") return "BEST SELLERS";
  if (sort === "new") return "NEW ARRIVALS";
  const cat = (params.get("category") || "").toLowerCase();
  if (!cat) return "ALL";
  const match = categories.find((c) => c.toLowerCase() === cat);
  return match || "ALL";
}

function effectiveOrder(params) {
  const order = params.get("order");
  if (order && ORDERING_MAP[order]) return order;
  if (params.get("sort") === "new") return "newest";
  return "price_desc";
}

function splitOrder(order) {
  if (order === "price_asc") return { field: "price", dir: "asc" };
  if (order === "price_desc") return { field: "price", dir: "desc" };
  if (order === "oldest") return { field: "newest", dir: "asc" };
  if (order === "newest") return { field: "newest", dir: "desc" };
  if (order === "best") return { field: "best", dir: "desc" };
  return { field: "price", dir: "desc" };
}

function orderFrom(field, dir) {
  if (field === "best") return "best";
  if (field === "newest") return dir === "asc" ? "oldest" : "newest";
  return dir === "asc" ? "price_asc" : "price_desc";
}

function apiParamsFromSearch(params) {
  const out = {};
  const sort = params.get("sort");
  const cat = params.get("category");
  const q = (params.get("search") || "").trim();
  if (sort === "best") out.is_best_seller = "true";
  if (cat) out.category__slug = cat.toLowerCase();
  if (q) out.search = q;
  out.ordering = ORDERING_MAP[effectiveOrder(params)] || "-price";
  return out;
}

export default function ProductList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isWished, toggleWishlist: toggleWishlistCtx, addToCart } = useShop();
  const activeTab = tabFromSearch(searchParams);
  const showSort = location.pathname === "/shop";
  const searchQuery = (searchParams.get("search") || "").trim();
  const { field: sortField, dir: sortDir } = splitOrder(effectiveOrder(searchParams));
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Fetch products whenever the URL filters change (?sort=, ?category=, ?order=, ?search=).
  useEffect(() => {
    let cancelled = false;
    getProducts(apiParamsFromSearch(new URLSearchParams(location.search)))
      .then((data) => {
        if (cancelled) return;
        setProducts(data.results || []);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data
            ? `Failed to load products: ${JSON.stringify(err.response.data)}`
            : `Failed to load products: ${err.message}`
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  function selectTab(tab) {
    setLoading(true);
    setError("");
    const next = new URLSearchParams();
    const order = searchParams.get("order");
    // Keep an active search query when switching category/sort tabs.
    if (searchQuery) next.set("search", searchQuery);
    if (tab === "BEST SELLERS") {
      if (order) next.set("order", order);
      next.set("sort", "best");
    } else if (tab === "NEW ARRIVALS") {
      next.set("sort", "new");
    } else if (tab !== "ALL") {
      if (order) next.set("order", order);
      next.set("category", tab.toLowerCase());
    } else if (order) {
      next.set("order", order);
    }
    setSearchParams(next);
  }

  function changeOrder(order) {
    setLoading(true);
    const next = new URLSearchParams(searchParams);
    if (order === "price_desc" && !searchParams.get("sort") && !searchParams.get("category")) {
      next.delete("order");
    } else {
      next.set("order", order);
    }
    setSearchParams(next);
  }

  function changeSortField(field) {
    changeOrder(orderFrom(field, sortDir));
  }

  function changeSortDir(dir) {
    changeOrder(orderFrom(sortField, dir));
  }

  async function toggleWishlist(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!getAccessToken()) {
      navigate("/auth");
      return;
    }
    try {
      await toggleWishlistCtx(id);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        navigate("/auth");
      }
    }
  }

  async function handleAddToCart(e, product) {
    e.preventDefault();
    e.stopPropagation();
    // Quick-add from grid: size only for Clothing (has_size_options).
    const size = product?.has_size_options ? "M" : "";
    await addToCart(product.id, 1, "", size);
  }

  return (
    <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      {/* Sort By (shop page only) */}
      {showSort && (
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span className="text-sm font-sans text-gray-900">Sort By :</span>
          <select
            value={sortField}
            onChange={(e) => changeSortField(e.target.value)}
            className="min-h-[44px] text-sm font-sans text-gray-900 bg-white border border-gray-300 rounded-sm px-3 py-2 cursor-pointer focus:outline-none focus:border-primary"
            aria-label="Sort field"
          >
            <option value="price">Price</option>
            <option value="newest">Newest</option>
            <option value="best">Best Selling</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => changeSortDir(e.target.value)}
            disabled={sortField === "best"}
            className="min-h-[44px] text-sm font-sans text-gray-900 bg-white border border-gray-300 rounded-sm px-3 py-2 cursor-pointer focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Sort direction"
          >
            <option value="desc">High To Low</option>
            <option value="asc">Low To High</option>
          </select>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => selectTab(cat)}
            className={`text-sm font-sans tracking-wide transition-colors cursor-pointer px-2 py-3 min-h-[44px] flex items-center ${
              activeTab === cat
                ? "text-primary font-semibold border-b-2 border-primary pb-1"
                : "text-gray-900 hover:text-primary pb-1 border-b-2 border-transparent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : error ? (
        <p className="text-center text-accent py-10">{error}</p>
      ) : products.length === 0 ? (
        <div className="text-center py-10">
          {searchQuery ? (
            <>
              <p className="text-gray-900 font-sans">
                No results for &ldquo;{searchQuery}&rdquo;.
              </p>
              <p className="text-gray-500 font-sans mt-2">
                Try a different keyword, or browse the full catalog.
              </p>
            </>
          ) : (
            <p className="text-gray-500 font-sans">No products found.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-[fadeIn_0.3s_ease-out]">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              wished={isWished(product.id)}
              onToggleWishlist={toggleWishlist}
              onQuickView={setQuickViewProduct}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          key={quickViewProduct.id}
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
        />
      )}
    </section>
  );
}
