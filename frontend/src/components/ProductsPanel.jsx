import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDashboardProduct,
  deactivateDashboardProduct,
  deleteDashboardProductHard,
  deleteDashboardProductImage,
  getDashboardCategories,
  getDashboardProducts,
  setDashboardProductPrimaryImage,
  updateDashboardProduct,
} from "../api/dashboard";
import { Skeleton } from "./Skeleton";

const emptyForm = {
  name: "",
  category_id: "",
  price: "",
  stock: "0",
  description: "",
  is_active: true,
  is_best_seller: false,
};

// Must match ProductDetail.jsx / QuickViewModal.jsx swatch list.
const COLOR_OPTIONS = ["White", "Black"];

function missingColorPhotos(product) {
  if (!product?.category?.has_color_options) return [];
  const tagged = new Set(
    (product.images || [])
      .map((img) => (img.color || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return COLOR_OPTIONS.filter((c) => !tagged.has(c.toLowerCase()));
}

function formatMoney(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value ?? "—";
  return `$${n.toFixed(2)}`;
}

function flattenCategories(nodes, depth = 0) {
  const out = [];
  for (const n of nodes || []) {
    out.push({
      id: n.id,
      label: `${" ".repeat(depth)}${n.name}`,
      has_color_options: Boolean(n.has_color_options),
    });
    if (n.children?.length) out.push(...flattenCategories(n.children, depth + 1));
  }
  return out;
}

function apiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  return Object.values(data)
    .flat()
    .join(" ");
}

function validateForm(form) {
  const errs = {};
  if (!form.name.trim()) errs.name = "Product name is required.";
  if (!form.category_id) errs.category = "Please choose a category.";
  const price = parseFloat(form.price);
  if (form.price === "" || Number.isNaN(price)) errs.price = "Enter a price.";
  else if (price <= 0) errs.price = "Price must be a positive number.";
  const stock = Number(form.stock);
  if (form.stock === "" || !Number.isInteger(stock) || stock < 0)
    errs.stock = "Stock must be a whole number of 0 or more.";
  return errs;
}

function fieldClass(bad) {
  return `w-full min-h-[44px] px-3 text-sm font-sans text-gray-900 border rounded-md outline-none focus:border-primary placeholder:text-gray-400 ${
    bad ? "border-accent" : "border-gray-200"
  }`;
}

function toGalleryItems(initial) {
  return (initial?.images || []).map((img) => ({
    key: `srv-${img.id}`,
    id: img.id,
    url: img.image,
    file: null,
    is_primary: Boolean(img.is_primary),
    color: img.color || "",
  }));
}

function ProductForm({ categories, initial, onCancel, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: initial.name || "",
          category_id: initial.category?.id || initial.category_id || "",
          price: String(initial.price ?? ""),
          stock: String(initial.stock ?? 0),
          description: initial.description || "",
          is_active: initial.is_active !== false,
          is_best_seller: Boolean(initial.is_best_seller),
        }
      : { ...emptyForm }
  );
  const [gallery, setGallery] = useState(() => toGalleryItems(initial));
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null); // { type, text }
  const [saving, setSaving] = useState(false);
  const [busyImageId, setBusyImageId] = useState(null);
  const fileRef = useRef(null);
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key] && !e[key.replace("_id", "")]) return e;
      const next = { ...e };
      delete next[key];
      delete next[key.replace("_id", "")];
      return next;
    });
  }

  function onImagesChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((file, i) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return {
        key: `new-${Date.now()}-${i}-${file.name}`,
        id: null,
        url,
        file,
        is_primary: false,
        color: "",
      };
    });
    setGallery((g) => {
      const hasPrimary = g.some((x) => x.is_primary);
      if (!hasPrimary && next[0]) next[0].is_primary = true;
      return [...g, ...next];
    });
    e.target.value = "";
  }

  function setGalleryColor(key, color) {
    setGallery((g) => g.map((x) => (x.key === key ? { ...x, color } : x)));
  }

  const colorEnabled = useMemo(() => {
    const cat = categories.find((c) => String(c.id) === String(form.category_id));
    return Boolean(cat?.has_color_options);
  }, [categories, form.category_id]);

  const missingColors = colorEnabled
    ? COLOR_OPTIONS.filter(
        (c) =>
          gallery.length > 0 &&
          !gallery.some((g) => (g.color || "").trim().toLowerCase() === c.toLowerCase())
      )
    : [];

  function removeGalleryItem(item) {
    if (item.file && item.url.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
      objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== item.url);
    }
    setGallery((g) => {
      const next = g.filter((x) => x.key !== item.key);
      if (item.is_primary && next.length) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  }

  async function handleRemoveServerImage(item) {
    if (!isEdit || !item.id) return;
    setBusyImageId(item.id);
    setFeedback(null);
    try {
      const updated = await deleteDashboardProductImage(initial.id, item.id);
      setGallery(toGalleryItems(updated));
      setFeedback({ type: "success", text: "Image removed." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: apiErrorMessage(err, "Could not remove the image."),
      });
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleSetPrimary(item) {
    if (item.is_primary) return;
    setFeedback(null);
    if (item.id && isEdit) {
      setBusyImageId(item.id);
      try {
        const updated = await setDashboardProductPrimaryImage(initial.id, item.id);
        setGallery(toGalleryItems(updated));
        setFeedback({ type: "success", text: "Primary image updated." });
      } catch (err) {
        setFeedback({
          type: "error",
          text: apiErrorMessage(err, "Could not set primary image."),
        });
      } finally {
        setBusyImageId(null);
      }
      return;
    }
    // Local-only (not yet uploaded): mark primary; applied on save via primary_new_index.
    setGallery((g) => g.map((x) => ({ ...x, is_primary: x.key === item.key })));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFeedback({
        type: "error",
        text: "Please fix the highlighted fields.",
      });
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("category_id", String(form.category_id));
      fd.append("price", String(parseFloat(form.price).toFixed(2)));
      fd.append("stock", String(parseInt(form.stock, 10)));
      fd.append("description", form.description);
      fd.append("is_active", form.is_active ? "true" : "false");
      fd.append("is_best_seller", form.is_best_seller ? "true" : "false");

      const pending = gallery.filter((x) => x.file);
      pending.forEach((x) => {
        fd.append("images", x.file);
        fd.append("image_colors", colorEnabled ? x.color || "" : "");
      });
      // Retag already-uploaded rows (color dropdown changes).
      const colorUpdates = {};
      gallery
        .filter((x) => x.id)
        .forEach((x) => {
          colorUpdates[x.id] = colorEnabled ? x.color || "" : "";
        });
      if (Object.keys(colorUpdates).length) {
        fd.append("image_color_updates", JSON.stringify(colorUpdates));
      }
      const primaryPending = pending.find((x) => x.is_primary);
      if (primaryPending) {
        fd.append("primary_new_index", String(pending.indexOf(primaryPending)));
      } else {
        const primarySrv = gallery.find((x) => x.id && x.is_primary);
        if (primarySrv) fd.append("primary_image_id", String(primarySrv.id));
      }

      if (isEdit) {
        await updateDashboardProduct(initial.id, fd);
        setFeedback({ type: "success", text: "Product updated." });
      } else {
        await createDashboardProduct(fd);
        setFeedback({ type: "success", text: "Product created." });
      }
      onSaved();
      if (!isEdit) {
        setForm({ ...emptyForm });
        setGallery([]);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: apiErrorMessage(err, "Could not save the product. Please try again."),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mb-6 p-4 sm:p-5 bg-gray-50 border border-gray-100 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-sans font-semibold text-gray-900">
          {isEdit ? `Edit product: ${initial.name}` : "Add new product"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-3 text-sm font-sans text-gray-600 hover:text-primary transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {feedback && (
        <p
          role={feedback.type === "success" ? "status" : "alert"}
          className={`mb-4 text-sm font-sans px-4 py-3 rounded-md border ${
            feedback.type === "success"
              ? "text-primary bg-primary/5 border-primary/20"
              : "text-accent bg-accent/5 border-accent/20"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="product-name"
            className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5"
          >
            Product name
          </label>
          <input
            id="product-name"
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className={fieldClass(errors.name)}
            placeholder="Enter product name"
          />
          {errors.name && (
            <p role="alert" className="text-accent text-xs font-sans mt-1">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="product-category"
            className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5"
          >
            Category
          </label>
          <select
            id="product-category"
            value={form.category_id}
            onChange={(e) => setField("category_id", e.target.value)}
            className={fieldClass(errors.category)}
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p role="alert" className="text-accent text-xs font-sans mt-1">
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="product-price"
            className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5"
          >
            Price ($)
          </label>
          <input
            id="product-price"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            className={fieldClass(errors.price)}
            placeholder="0.00"
          />
          {errors.price && (
            <p role="alert" className="text-accent text-xs font-sans mt-1">
              {errors.price}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="product-stock"
            className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5"
          >
            Stock quantity
          </label>
          <input
            id="product-stock"
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(e) => setField("stock", e.target.value)}
            className={fieldClass(errors.stock)}
            placeholder="0"
          />
          {errors.stock && (
            <p role="alert" className="text-accent text-xs font-sans mt-1">
              {errors.stock}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <span className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5">
            Product images
          </span>
          <div className="flex flex-wrap gap-3 mb-3" data-testid="image-gallery">
            {gallery.length === 0 && (
              <p className="text-xs font-sans text-gray-400">No images yet.</p>
            )}
            {gallery.map((item) => (
              <div key={item.key} className="flex flex-col gap-1 w-20">
                <div className="relative w-20 h-20 border border-gray-200 rounded overflow-hidden bg-white">
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      item.id
                        ? handleRemoveServerImage(item)
                        : removeGalleryItem(item)
                    }
                    disabled={busyImageId === item.id}
                    aria-label="Remove image"
                    className="absolute top-0 right-0 w-6 h-6 bg-black/55 text-white text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(item)}
                    disabled={busyImageId === item.id || item.is_primary}
                    aria-label={item.is_primary ? "Primary image" : "Set as primary"}
                    title={item.is_primary ? "Primary" : "Set as primary"}
                    className={`absolute bottom-0 inset-x-0 text-[9px] font-sans py-0.5 cursor-pointer disabled:cursor-default ${
                      item.is_primary
                        ? "bg-primary text-white"
                        : "bg-black/55 text-white hover:bg-black/75"
                    }`}
                  >
                    {item.is_primary ? "Primary" : "Set primary"}
                  </button>
                </div>
                {colorEnabled && (
                  <select
                    value={item.color || ""}
                    onChange={(e) => setGalleryColor(item.key, e.target.value)}
                    data-testid="image-color-select"
                    aria-label="Image color"
                    className="w-full h-7 text-[11px] font-sans text-gray-700 border border-gray-200 rounded px-1 bg-white cursor-pointer"
                  >
                    <option value="">No color</option>
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <input
            ref={fileRef}
            id="product-images"
            type="file"
            accept="image/*"
            multiple
            onChange={onImagesChange}
            className="block text-xs font-sans text-gray-600 file:mr-3 file:min-h-[36px] file:px-3 file:py-1.5 file:border file:border-gray-200 file:rounded file:bg-white file:text-xs file:font-sans file:text-gray-700 hover:file:border-primary cursor-pointer"
          />
          <p className="text-[11px] text-gray-400 font-sans mt-1">
            Select multiple photos. The image marked Primary is shown on the Shop
            grid card.
            {colorEnabled
              ? " Tag each photo White or Black so the product page can switch images with the color swatch."
              : ""}
          </p>
          {missingColors.length > 0 && (
            <p
              data-testid="missing-color-images"
              role="status"
              className="text-xs font-sans text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2"
            >
              Missing color photo{missingColors.length > 1 ? "s" : ""}:{" "}
              {missingColors.join(", ")}. Until tagged, the product page falls
              back to the primary image.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="product-description"
            className="block text-xs font-sans font-semibold text-gray-900 uppercase tracking-wide mb-1.5"
          >
            Description
          </label>
          <textarea
            id="product-description"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            className={`${fieldClass(false)} py-2 resize-y`}
            placeholder="Describe the product for shoppers"
          />
        </div>

        <label className="flex items-center gap-2 min-h-[44px] text-sm font-sans text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
            className="accent-primary w-5 h-5 cursor-pointer"
          />
          Show in shop (active)
        </label>

        <label className="flex items-center gap-2 min-h-[44px] text-sm font-sans text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_best_seller}
            onChange={(e) => setField("is_best_seller", e.target.checked)}
            className="accent-primary w-5 h-5 cursor-pointer"
          />
          Mark as best seller
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-6 py-2.5 bg-primary text-white font-sans text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-6 py-2.5 border border-gray-200 text-gray-700 font-sans text-sm rounded-md hover:border-gray-300 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ProductsPanel({ onCountChange }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listFeedback, setListFeedback] = useState(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [mode, setMode] = useState("list"); // list | create | edit
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadAll = useCallback(async () => {
    const [prods, cats] = await Promise.all([
      getDashboardProducts(),
      getDashboardCategories(),
    ]);
    setProducts(prods);
    setCategories(flattenCategories(cats));
    if (onCountChange) onCountChange(prods.length);
  }, [onCountChange]);

  useEffect(() => {
    let cancelled = false;
    // Mirror Cart.jsx data-load pattern: async fetch then setState.
    getDashboardProducts()
      .then((prods) => {
        if (cancelled) return;
        setProducts(prods);
        if (onCountChange) onCountChange(prods.length);
        return getDashboardCategories();
      })
      .then((cats) => {
        if (cancelled || !cats) return;
        setCategories(flattenCategories(cats));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(apiErrorMessage(err, "Failed to load products."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onCountChange]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category_name || p.category?.name || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortAsc ? cmp : -cmp;
    });
  }, [products, search, sortAsc]);

  async function handleSaved() {
    try {
      await loadAll();
      setListFeedback({
        type: "success",
        text: mode === "edit" ? "Product updated." : "Product created.",
      });
      setMode("list");
      setEditing(null);
    } catch {
      setListFeedback({
        type: "error",
        text: "Saved, but the list could not refresh. Reload the page.",
      });
    }
  }

  async function handleDeactivate(product) {
    if (
      !window.confirm(
        `Hide "${product.name}" from the shop? It will stay in your list (you can show it again later) and past orders keep working.`
      )
    ) {
      return;
    }
    setBusyId(product.id);
    setListFeedback(null);
    try {
      await deactivateDashboardProduct(product.id);
      await loadAll();
      setListFeedback({
        type: "success",
        text: `"${product.name}" is now hidden from the shop.`,
      });
    } catch (err) {
      setListFeedback({
        type: "error",
        text: apiErrorMessage(err, "Could not hide the product."),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(product) {
    setBusyId(product.id);
    setListFeedback(null);
    try {
      const fd = new FormData();
      fd.append("is_active", "true");
      await updateDashboardProduct(product.id, fd);
      await loadAll();
      setListFeedback({
        type: "success",
        text: `"${product.name}" is visible in the shop again.`,
      });
    } catch (err) {
      setListFeedback({
        type: "error",
        text: apiErrorMessage(err, "Could not show the product."),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleHardDelete(product) {
    const ok = window.confirm(
      `Are you sure you want to permanently delete ${product.name}? This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(product.id);
    setListFeedback(null);
    try {
      await deleteDashboardProductHard(product.id);
      if (mode === "edit" && editing?.id === product.id) {
        setMode("list");
        setEditing(null);
      }
      await loadAll();
      setListFeedback({
        type: "success",
        text: `"${product.name}" was permanently deleted.`,
      });
    } catch (err) {
      setListFeedback({
        type: "error",
        text: apiErrorMessage(err, "Could not delete the product."),
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" rounded="rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-accent text-sm font-sans">
        {error}
      </p>
    );
  }

  return (
    <section aria-label="Products">
      {listFeedback && (
        <p
          role={listFeedback.type === "success" ? "status" : "alert"}
          className={`mb-4 text-sm font-sans px-4 py-3 rounded-md border ${
            listFeedback.type === "success"
              ? "text-primary bg-primary/5 border-primary/20"
              : "text-accent bg-accent/5 border-accent/20"
          }`}
        >
          {listFeedback.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="dashboard-product-search" className="sr-only">
            Search products
          </label>
          <input
            id="dashboard-product-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category"
            className="w-full sm:max-w-sm min-h-[44px] px-4 text-sm font-sans text-gray-900 border border-gray-200 rounded-md outline-none focus:border-primary placeholder:text-gray-400"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "create" ? "list" : "create");
            setEditing(null);
            setListFeedback(null);
          }}
          className="min-h-[44px] px-5 py-2.5 bg-primary text-white font-sans text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
        >
          {mode === "create" ? "Close form" : "Add New Product"}
        </button>
      </div>

      {mode !== "list" && (
        <ProductForm
          key={mode === "edit" && editing ? `edit-${editing.id}` : "create"}
          categories={categories}
          initial={editing}
          onCancel={() => {
            setMode("list");
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSortAsc((s) => !s)}
          className="min-h-[44px] px-3 text-xs font-sans text-gray-600 hover:text-primary transition-colors cursor-pointer border border-gray-200 rounded"
          aria-label="Toggle name sort"
        >
          Name {sortAsc ? "A→Z" : "Z→A"}
        </button>
        <span className="text-xs font-sans text-gray-400">
          {visible.length} product{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 text-lg font-sans">
          {products.length === 0
            ? "No products yet. Add your first product."
            : "No products match your search."}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 p-4 border border-gray-100 rounded-lg"
            >
              <div className="w-12 h-12 flex-shrink-0 bg-white border border-gray-100 rounded overflow-hidden flex items-center justify-center">
                {p.primary_image ? (
                  <img
                    src={p.primary_image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[9px] text-gray-400 font-sans">No image</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-sans text-gray-900 font-semibold break-words">
                  {p.name}
                </p>
                <p className="text-xs font-sans text-gray-500 mt-0.5">
                  {p.category?.name || p.category_name || "Uncategorized"} · Stock:{" "}
                  {p.stock}
                </p>
                {missingColorPhotos(p).length > 0 && (
                  <p
                    data-testid="missing-color-badge"
                    className="text-xs font-sans text-amber-700 mt-1"
                  >
                    Missing color photo: {missingColorPhotos(p).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs font-sans px-2 py-1 rounded-full whitespace-nowrap border ${
                    p.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {p.is_active ? "Active" : "Inactive"}
                </span>
                <p className="text-sm font-sans text-gray-900 font-semibold min-w-[64px] text-right">
                  {formatMoney(p.price)}
                </p>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => {
                    setMode("edit");
                    setEditing(p);
                    setListFeedback(null);
                  }}
                  className="min-h-[44px] px-3 text-sm font-sans text-primary hover:underline cursor-pointer disabled:opacity-50"
                >
                  Edit
                </button>
                {p.is_active ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleDeactivate(p)}
                    className="min-h-[44px] px-3 text-sm font-sans text-gray-600 hover:text-accent transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busyId === p.id ? "Saving…" : "Deactivate"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleReactivate(p)}
                    className="min-h-[44px] px-3 text-sm font-sans text-primary hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {busyId === p.id ? "Saving…" : "Show in shop"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => handleHardDelete(p)}
                  className="min-h-[44px] px-3 text-sm font-sans text-accent hover:underline cursor-pointer disabled:opacity-50"
                >
                  {busyId === p.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
