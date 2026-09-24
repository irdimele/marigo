import { useEffect, useMemo, useState } from "react";
import { getDashboardMessages, getDashboardOrders } from "../api/dashboard";
import { Skeleton } from "../components/Skeleton";
import ProductsPanel from "../components/ProductsPanel";

const tabs = ["Orders", "Messages", "Products"];

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  paid: "bg-primary/10 text-primary border border-primary/30",
  shipped: "bg-sky-50 text-sky-700 border border-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-accent/10 text-accent border border-accent/30",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMoney(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value ?? "—";
  return `$${n.toFixed(2)}`;
}

function customerName(order) {
  const name = [order.first_name, order.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  return order.email || "Guest";
}

function StatusBadge({ status }) {
  const key = (status || "").toLowerCase();
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : "Unknown";
  return (
    <span
      className={`inline-block text-xs font-sans px-2 py-1 rounded-full whitespace-nowrap ${
        statusStyles[key] || "bg-gray-100 text-gray-700 border border-gray-200"
      }`}
    >
      Status: {label}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" rounded="rounded-lg" />
      ))}
    </div>
  );
}

function OrderDetail({ order }) {
  return (
    <div className="mt-3 p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="text-xs font-sans text-gray-500">
          {formatDate(order.created_at)} · {order.items?.length || 0} item
          {(order.items?.length || 0) === 1 ? "" : "s"} · {formatMoney(order.total_amount)}
        </span>
      </div>
      <div>
        <h4 className="text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-2">
          Billing details
        </h4>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm font-sans text-gray-700">
          <div>
            <dt className="inline font-semibold text-gray-900">Name: </dt>
            <dd className="inline">{customerName(order)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-900">Email: </dt>
            <dd className="inline break-words">{order.email || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-900">Phone: </dt>
            <dd className="inline">{order.phone || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-900">Payment: </dt>
            <dd className="inline">
              {order.payment_method === "paypal" ? "Paypal" : "Pay with Card"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline font-semibold text-gray-900">Address: </dt>
            <dd className="inline break-words">
              {[order.address, order.city, order.zip_code, order.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
          </div>
          {order.recipient_address && (
            <div className="sm:col-span-2">
              <dt className="inline font-semibold text-gray-900">Ship to: </dt>
              <dd className="inline break-words">{order.recipient_address}</dd>
            </div>
          )}
          {order.customer_note && (
            <div className="sm:col-span-2">
              <dt className="inline font-semibold text-gray-900">Note: </dt>
              <dd className="inline break-words">{order.customer_note}</dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <h4 className="text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-2">
          Items
        </h4>
        {order.items?.length ? (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start sm:items-center justify-between gap-2 px-4 py-3 text-sm font-sans"
              >
                <div className="min-w-0">
                  <p className="text-gray-900 font-medium break-words">
                    {item.product?.name || "Deleted product"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[
                      item.color && `Color: ${item.color}`,
                      item.size && `Size: ${item.size}`,
                      `Quantity: ${item.quantity}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="text-gray-900 flex-shrink-0">
                  {formatMoney(item.unit_price)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 font-sans">No items.</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("Orders");
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [productCount, setProductCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([getDashboardOrders(), getDashboardMessages()])
      .then(([orderList, messageList]) => {
        setOrders(orderList);
        setMessages(messageList);
      })
      .catch((err) => {
        const status = err?.response?.status;
        setError(
          status === 403
            ? "You don't have permission to view the dashboard."
            : status === 401
              ? "Please log in again to view the dashboard."
              : `Failed to load dashboard${status ? ` (${status})` : ""}.`
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const name = customerName(o).toLowerCase();
      const id = String(o.id).toLowerCase();
      const email = (o.email || "").toLowerCase();
      return name.includes(q) || id.includes(q) || email.includes(q);
    });
  }, [orders, search]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
        <h2 className="font-display text-3xl font-bold text-gray-900 mb-6">
          Dashboard
        </h2>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
        <h2 className="font-display text-3xl font-bold text-gray-900 mb-6">
          Dashboard
        </h2>
        <p role="alert" className="text-accent text-sm font-sans">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
      <h2 className="font-display text-3xl font-bold text-gray-900 mb-6">
        Dashboard
      </h2>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 pb-3 text-lg font-display font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
              tab === t
                ? "text-primary border-primary"
                : "text-gray-400 border-transparent hover:text-gray-700"
            }`}
          >
            {t}
            {t === "Orders" && (
              <span className="ml-2 text-sm font-sans font-normal text-gray-400">
                {orders.length}
              </span>
            )}
            {t === "Messages" && (
              <span className="ml-2 text-sm font-sans font-normal text-gray-400">
                {messages.length}
              </span>
            )}
            {t === "Products" && productCount !== null && (
              <span className="ml-2 text-sm font-sans font-normal text-gray-400">
                {productCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Orders" && (
        <section aria-label="Orders">
          <div className="mb-4">
            <label htmlFor="dashboard-order-search" className="sr-only">
              Search orders
            </label>
            <input
              id="dashboard-order-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or order #"
              className="w-full sm:max-w-sm min-h-[44px] px-4 text-sm font-sans text-gray-900 border border-gray-200 rounded-md outline-none focus:border-primary placeholder:text-gray-400"
            />
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-gray-500 text-lg font-sans">
              {orders.length === 0 ? "No orders yet." : "No orders match your search."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((o) => {
                const open = expandedOrder === o.id;
                const itemCount = o.items?.length || 0;
                return (
                  <div key={o.id} className="border border-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(open ? null : o.id)}
                      aria-expanded={open}
                      className="w-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-4 text-left cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-sans text-gray-900 font-semibold">
                          Order #{o.id}
                        </p>
                        <p className="text-xs font-sans text-gray-500 mt-1 break-words">
                          {customerName(o)}
                        </p>
                        <p className="text-xs font-sans text-gray-500 mt-0.5 break-words">
                          {formatDate(o.created_at)} · {itemCount} item
                          {itemCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="sm:text-right sm:self-center">
                        <p className="text-sm font-sans text-gray-900 font-semibold whitespace-nowrap">
                          {formatMoney(o.total_amount)}
                        </p>
                      </div>
                    </button>
                    {open && <div className="px-4 pb-4">
                      <OrderDetail order={o} />
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "Messages" && (
        <section aria-label="Messages">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-lg font-sans">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const open = expandedMessage === m.id;
                const preview =
                  m.message.length > 120
                    ? `${m.message.slice(0, 120)}…`
                    : m.message;
                return (
                  <div key={m.id} className="border border-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExpandedMessage(open ? null : m.id)}
                      aria-expanded={open}
                      className="w-full flex flex-wrap items-start justify-between gap-3 p-4 text-left cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-sans text-gray-900 font-semibold">
                          {m.name}
                        </p>
                        <p className="text-xs font-sans text-gray-500 mt-0.5 break-words">
                          {m.email} · {formatDate(m.created_at)}
                        </p>
                        <p className="text-sm font-sans text-gray-600 mt-2 break-words">
                          {open ? m.message : preview}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "Products" && (
        <ProductsPanel onCountChange={setProductCount} />
      )}
    </div>
  );
}
