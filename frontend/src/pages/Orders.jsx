import { useEffect, useState } from "react";
import { getOrders } from "../api/orders";
import { OrdersSkeleton } from "../components/Skeleton";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrders()
      .then((data) => setOrders(data.results || []))
      .catch((err) => {
        const status = err?.response?.status;
        setError(
          err?.response?.data
            ? `Failed to load orders (${status || "?"}): ${JSON.stringify(err.response.data)}`
            : `Failed to load orders: ${err.message} (401 = please login first)`
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <OrdersSkeleton />;
  if (error) return <p role="alert" className="text-center py-20 text-accent">Error: {error}</p>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
      <h2 className="font-display text-3xl font-bold text-gray-900 mb-6">Orders</h2>
      {orders.length === 0 ? (
        <p className="text-gray-500 text-lg font-sans">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-start sm:items-center justify-between gap-3 p-4 border border-gray-100 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                  <p className="text-sm font-sans text-gray-900 font-semibold">
                    Order #{o.id}
                  </p>
                  <p className="text-xs font-sans text-gray-500 mt-1 break-words">
                    {o.items?.length || 0} item
                    {(o.items?.length || 0) === 1 ? "" : "s"}
                    {o.items?.some((i) => i.color || i.size) &&
                      ` — ${o.items
                        .map((i) =>
                          [i.product?.name, i.color, i.size]
                            .filter(Boolean)
                            .join(" ")
                        )
                        .join("; ")}`}
                  </p>
                </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-sans text-gray-900">
                  ${o.total_amount}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
