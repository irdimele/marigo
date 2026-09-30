import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  bulkDeleteDashboardMessages,
  deleteDashboardMessage,
  getDashboardMessages,
  getDashboardOrders,
  setDashboardOrderDone,
} from "../api/dashboard";
import { Skeleton } from "../components/Skeleton";
import ProductsPanel from "../components/ProductsPanel";

// Lazy: recharts only loads when the Revenue tab is opened.
const RevenuePanel = lazy(() => import("../components/RevenuePanel"));

const tabs = ["Orders", "Revenue", "Messages", "Products"];
const orderFilters = ["All", "To do", "Done"];

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
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="text-gray-900 flex-shrink-0 text-right">
                  <span className="text-gray-500">
                    {formatMoney(item.unit_price)} × {item.quantity} ={" "}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(parseFloat(item.unit_price) * item.quantity)}
                  </span>
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
  const [orderFilter, setOrderFilter] = useState("To do");
  const [togglingId, setTogglingId] = useState(null);
  // Message deletion
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState(null); // {ids: [], name?: string}
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const toggleMsgSelection = (id) => {
    setSelectedMsgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = messages.length > 0 && selectedMsgIds.length === messages.length;

  const toggleSelectAll = () => {
    setSelectedMsgIds(allSelected ? [] : messages.map((m) => m.id));
  };

  const confirmDelete = async () => {
    if (!deleteDialog || deleting) return;
    const { ids } = deleteDialog;
    setDeleting(true);
    setDeleteError("");
    try {
      if (ids.length === 1) {
        await deleteDashboardMessage(ids[0]);
      } else {
        await bulkDeleteDashboardMessages(ids);
      }
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
      setSelectedMsgIds((prev) => prev.filter((x) => !ids.includes(x)));
      setExpandedMessage((prev) => (ids.includes(prev) ? null : prev));
      setDeleteDialog(null);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setDeleteError(
        detail ||
          (status === 403
            ? "You don't have permission to delete messages."
            : status === 404
              ? "This message no longer exists."
              : "Failed to delete. Please try again.")
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleOrderDone = async (order) => {
    const next = !order.is_done;
    setTogglingId(order.id);
    // Optimistic: flip local state immediately so the row moves between
    // To do/Done without waiting for the PATCH to resolve.
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, is_done: next } : o))
    );
    try {
      const updated = await setDashboardOrderDone(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
    } catch {
      // PATCH failed — revert the optimistic flip.
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, is_done: !next } : o))
      );
    } finally {
      setTogglingId(null);
    }
  };

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
    return orders.filter((o) => {
      if (orderFilter === "To do" && o.is_done) return false;
      if (orderFilter === "Done" && !o.is_done) return false;
      if (!q) return true;
      const name = customerName(o).toLowerCase();
      const id = String(o.id).toLowerCase();
      const orderLabel = `order #${o.id}`;
      const email = (o.email || "").toLowerCase();
      return (
        name.includes(q) ||
        id === q ||
        orderLabel.includes(q) ||
        email.includes(q)
      );
    });
  }, [orders, search, orderFilter]);

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
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div
              className="inline-flex rounded-md border border-gray-200 overflow-hidden"
              role="group"
              aria-label="Filter orders"
            >
              {orderFilters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrderFilter(f)}
                  aria-pressed={orderFilter === f}
                  className={`px-4 py-2 text-sm font-sans min-h-[40px] transition-colors cursor-pointer ${
                    orderFilter === f
                      ? "bg-primary text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <label htmlFor="dashboard-order-search" className="sr-only">
              Search orders
            </label>
            <input
              id="dashboard-order-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or order #"
              className="w-full sm:max-w-xs min-h-[44px] px-4 text-sm font-sans text-gray-900 border border-gray-200 rounded-md outline-none focus:border-primary placeholder:text-gray-400"
            />
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-gray-500 text-lg font-sans">
              {orders.length === 0
                ? "No orders yet."
                : orderFilter === "To do"
                  ? "Nothing to do — all orders are marked done."
                  : orderFilter === "Done"
                    ? "No done orders yet."
                    : "No orders match your search."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((o) => {
                const open = expandedOrder === o.id;
                const itemCount = o.items?.length || 0;
                const busy = togglingId === o.id;
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
                    <div className="px-4 pb-4 flex flex-wrap items-center gap-3">
                      {o.is_done ? (
                        <>
                          <span
                            data-testid="order-done-badge"
                            className="inline-block text-xs font-sans px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200"
                          >
                            Done
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleOrderDone(o)}
                            disabled={busy}
                            className="text-xs font-sans text-gray-500 underline hover:text-gray-800 cursor-pointer disabled:opacity-50"
                          >
                            Undo
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          data-testid="order-mark-done"
                          onClick={() => toggleOrderDone(o)}
                          disabled={busy}
                          className="text-xs font-sans px-3 py-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Mark as done"}
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="px-4 pb-4 -mt-2">
                        <OrderDetail order={o} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "Revenue" && (
        <Suspense fallback={<DashboardSkeleton />}>
          <RevenuePanel />
        </Suspense>
      )}

      {tab === "Messages" && (
        <section aria-label="Messages">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-lg font-sans">No messages yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="flex items-center gap-2 text-sm font-sans text-gray-600 cursor-pointer select-none min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all messages"
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  Select all
                </label>
                {selectedMsgIds.length > 0 && (
                  <div
                    className="flex items-center gap-3 px-3 py-2 bg-primary/10 border border-primary/30 rounded-md"
                    data-testid="bulk-delete-bar"
                  >
                    <span className="text-sm font-sans text-gray-900">
                      {selectedMsgIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteDialog({ ids: selectedMsgIds.slice() })
                      }
                      className="text-sm font-sans font-medium text-accent hover:underline cursor-pointer"
                    >
                      Delete selected
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {messages.map((m) => {
                  const open = expandedMessage === m.id;
                  const preview =
                    m.message.length > 120
                      ? `${m.message.slice(0, 120)}…`
                      : m.message;
                  const checked = selectedMsgIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className="border border-gray-100 rounded-lg flex items-start gap-2 p-3 sm:p-4"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMsgSelection(m.id)}
                        aria-label={`Select message from ${m.name}`}
                        className="w-4 h-4 mt-2 accent-primary cursor-pointer flex-shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedMessage(open ? null : m.id)}
                        aria-expanded={open}
                        className="flex-1 min-w-0 text-left cursor-pointer hover:bg-gray-50 transition-colors rounded-md py-1"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-sans text-gray-900 font-semibold break-words">
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
                      <button
                        type="button"
                        aria-label="Delete message"
                        data-testid={`delete-message-${m.id}`}
                        onClick={() =>
                          setDeleteDialog({ ids: [m.id], name: m.name })
                        }
                        className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "Products" && (
        <ProductsPanel onCountChange={setProductCount} />
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => {
            if (!deleting) {
              setDeleteDialog(null);
              setDeleteError("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-sans text-gray-900">
              {deleteDialog.ids.length === 1
                ? `Delete this message from ${deleteDialog.name}? This cannot be undone.`
                : `Delete ${deleteDialog.ids.length} messages? This cannot be undone.`}
            </p>
            {deleteError && (
              <p role="alert" className="mt-3 text-sm font-sans text-accent break-words">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                data-testid="delete-cancel"
                disabled={deleting}
                onClick={() => {
                  setDeleteDialog(null);
                  setDeleteError("");
                }}
                className="min-h-[44px] px-4 text-sm font-sans text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="delete-confirm"
                disabled={deleting}
                onClick={confirmDelete}
                className="min-h-[44px] px-4 text-sm font-sans font-medium text-white rounded-md bg-[#E7004C] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
