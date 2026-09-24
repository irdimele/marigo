import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCart } from "../api/cart";
import { checkout } from "../api/orders";

const SHIPPING_COST = 5;

const countries = [
  "Albania",
  "Kosovo",
  "North Macedonia",
  "Montenegro",
  "Greece",
  "Italy",
  "Germany",
  "United Kingdom",
  "United States",
];

const albanianCities = [
  "Durrës",
  "Tirana",
  "Vlorë",
  "Shkodër",
  "Elbasan",
  "Fier",
  "Korçë",
  "Berat",
];

const underlineBase =
  "w-full bg-transparent border-0 border-b-2 px-0 py-2.5 text-[15px] font-sans text-gray-900 outline-none transition-colors placeholder:text-gray-400";

function underlineClass(error, extra = "") {
  const state = error
    ? "border-accent focus:border-accent"
    : "border-gray-900 focus:border-primary";
  return `${underlineBase} ${state} ${extra}`.trim();
}

function FieldError({ error }) {
  if (!error) return null;
  return (
    <p className="text-accent text-xs font-sans mt-1.5" role="alert">
      {error}
    </p>
  );
}

function formatMoney(value) {
  return `${parseFloat(value).toFixed(0)}$`;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState({});
  const [payment, setPayment] = useState("card");

  // Billing fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("Albania");
  const [city, setCity] = useState("Durrës");
  const [cityOther, setCityOther] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Gift shipping
  const [sendToSomeone, setSendToSomeone] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCart()
      .then((data) => {
        if (!cancelled) setCart(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setCartError(
            err?.response?.data
              ? `Failed to load cart: ${JSON.stringify(err.response.data)}`
              : `Failed to load cart: ${err.message}`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCart(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = cart?.items || [];
  const subtotal = parseFloat(cart?.total_amount || 0);
  const total = items.length ? subtotal + SHIPPING_COST : 0;
  const resolvedCity = country === "Albania" ? city || cityOther : cityOther || city;

  function validate() {
    const errs = {};
    if (!firstName.trim()) errs.first_name = "First name is required.";
    if (!lastName.trim()) errs.last_name = "Last name is required.";
    if (!country.trim()) errs.country = "Country is required.";
    if (!resolvedCity.trim()) errs.city = "City is required.";
    if (!zip.trim()) errs.postal_code = "Zip code is required.";
    else if (!/^\d{4,9}$/.test(zip.trim()))
      errs.postal_code = "Zip code must be 4-9 digits.";
    if (!address.trim()) errs.line1 = "Address is required.";
    if (!phone.trim()) errs.phone = "Phone is required.";
    else if (phone.length < 7)
      errs.phone = "Phone number must be at least 7 digits.";
    if (!email.trim()) errs.email = "E-mail is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Enter a valid email address.";
    if (sendToSomeone && !recipientAddress.trim())
      errs.recipient_line1 = "Recipient address is required.";
    return errs;
  }

  function validateZipOnBlur() {
    const value = zip.trim();
    if (!value) {
      setErrors((prev) => ({ ...prev, postal_code: "Zip code is required." }));
      return;
    }
    if (!/^\d{4,9}$/.test(value)) {
      setErrors((prev) => ({
        ...prev,
        postal_code: "Zip code must be 4-9 digits.",
      }));
      return;
    }
    setErrors((prev) => {
      if (!prev.postal_code) return prev;
      const next = { ...prev };
      delete next.postal_code;
      return next;
    });
  }

  async function handleOrder(e) {
    e.preventDefault();
    if (submitting) return;
    setServerError("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const order = await checkout({
        payment_method: payment,
        billing: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country: country.trim(),
          city: resolvedCity.trim(),
          postal_code: zip.trim(),
          line1: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          send_to_someone: sendToSomeone,
          recipient_line1: sendToSomeone ? recipientAddress.trim() : "",
          note: note.trim(),
        },
      });
      // Success: cart cleared server-side → confirmation page.
      navigate(`/order-confirmation?order=${order.id}`);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object" && !data.detail) {
        const fieldErrs = {};
        Object.entries(data).forEach(([k, v]) => {
          fieldErrs[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setErrors((prev) => ({ ...prev, ...fieldErrs }));
        setServerError("Please fix the highlighted fields.");
      } else {
        setServerError(
          (data && (data.detail || Object.values(data).flat().join(" "))) ||
            `Order failed: ${err.message}`
        );
      }
      // Cart intentionally NOT cleared on failure.
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCart) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 text-center text-gray-500 font-sans">
        Loading checkout…
      </div>
    );
  }

  if (cartError) {
    return (
      <p className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 text-center text-accent" role="alert">
        {cartError}
      </p>
    );
  }

  if (!items.length) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20 text-center animate-[fadeIn_0.3s_ease-out]">
        <h1 className="font-display text-3xl font-semibold text-gray-900 mb-4">
          Checkout
        </h1>
        <p className="text-gray-500 font-sans mb-8">
          Your cart is empty — add something before checking out.
        </p>
        <Link
          to="/shop"
          className="inline-block bg-primary text-white font-sans text-sm px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 animate-[fadeIn_0.3s_ease-out]">
      <form onSubmit={handleOrder} noValidate className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Left: Billing Details */}
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 mb-8">
            Billing Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
            <div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name*"
                aria-label="First Name"
                autoComplete="given-name"
                className={underlineClass(errors.first_name)}
              />
              <FieldError error={errors.first_name} />
            </div>
            <div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name*"
                aria-label="Last Name"
                autoComplete="family-name"
                className={underlineClass(errors.last_name)}
              />
              <FieldError error={errors.last_name} />
            </div>

            <div>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="Country"
                className={underlineClass(errors.country, "cursor-pointer")}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <FieldError error={errors.country} />
            </div>
            <div>
              {/* Plain select for Albania; free text otherwise (no country→city dataset yet) */}
              {country === "Albania" ? (
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-label="City"
                  className={underlineClass(errors.city, "cursor-pointer")}
                >
                  <option value="">City*</option>
                  {albanianCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__other">Other…</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={cityOther}
                  onChange={(e) => setCityOther(e.target.value)}
                  placeholder="City*"
                  aria-label="City"
                  className={underlineClass(errors.city)}
                />
              )}
              {country === "Albania" && city === "__other" && (
                <input
                  type="text"
                  value={cityOther}
                  onChange={(e) => setCityOther(e.target.value)}
                  placeholder="Enter city*"
                  aria-label="City"
                  className={underlineClass(errors.city, "mt-2")}
                />
              )}
              <FieldError error={errors.city} />
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                onBlur={validateZipOnBlur}
                placeholder="Zip code*"
                aria-label="Zip code"
                autoComplete="postal-code"
                className={underlineClass(errors.postal_code)}
              />
              <FieldError error={errors.postal_code} />
            </div>
            <div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address*"
                aria-label="Address"
                autoComplete="street-address"
                className={underlineClass(errors.line1)}
              />
              <FieldError error={errors.line1} />
            </div>

            <div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Phone*"
                aria-label="Phone"
                autoComplete="tel"
                className={underlineClass(errors.phone)}
              />
              <FieldError error={errors.phone} />
            </div>
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail*"
                aria-label="E-mail"
                autoComplete="email"
                className={underlineClass(errors.email)}
              />
              <FieldError error={errors.email} />
            </div>
          </div>

          {/* Send to someone */}
          <label className="flex items-center gap-2.5 min-h-[44px] mt-8 text-sm font-sans text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToSomeone}
              onChange={(e) => setSendToSomeone(e.target.checked)}
              className="accent-primary w-5 h-5 cursor-pointer"
            />
            Send to someone
          </label>

          {sendToSomeone && (
            <div className="mt-6">
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Recipient shipping address*"
                aria-label="Recipient shipping address"
                className={underlineClass(errors.recipient_line1)}
              />
              <FieldError error={errors.recipient_line1} />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note"
                rows={3}
                maxLength={2000}
                className={underlineClass(null, "mt-6 resize-none min-h-[80px]")}
              />
            </div>
          )}
        </div>

        {/* Right: Payment Details */}
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 pb-3 border-b border-gray-300">
            Payment Details
          </h2>

          {/* Order summary */}
          <table className="w-full text-sm font-sans mt-6">
            <thead>
              <tr className="text-left text-gray-900">
                <th className="pb-3 font-semibold uppercase text-xs tracking-wide">
                  Products
                </th>
                <th className="pb-3 text-right font-semibold uppercase text-xs tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-4 text-gray-900">
                    {item.product?.name || "Item"}
                    {(item.color || item.size) && (
                      <span className="block text-xs text-gray-500">
                        {[item.color, item.size].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-900">
                    {formatMoney(item.line_total)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-4 text-gray-900 uppercase text-xs tracking-wide">
                  Shipping
                </td>
                <td className="py-2 text-right text-gray-900">
                  {formatMoney(SHIPPING_COST)}
                </td>
              </tr>
              <tr className="bg-gray-100">
                <td className="py-3 px-2 font-bold text-gray-900 uppercase text-xs tracking-wide">
                  Total
                </td>
                <td className="py-3 px-2 text-right font-bold text-accent">
                  {formatMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Payment method — UI stub only, no processor wired */}
          <fieldset className="mt-8">
            <legend className="sr-only">Payment method</legend>
            <label className="flex items-center gap-3 min-h-[44px] text-sm font-sans text-gray-900 cursor-pointer mb-1">
              <input
                type="radio"
                name="payment"
                value="card"
                checked={payment === "card"}
                onChange={() => setPayment("card")}
                className="accent-primary w-5 h-5 cursor-pointer"
              />
              Pay with Card
            </label>
            <label className="flex items-center gap-3 min-h-[44px] text-sm font-sans text-gray-900 cursor-pointer">
              <input
                type="radio"
                name="payment"
                value="paypal"
                checked={payment === "paypal"}
                onChange={() => setPayment("paypal")}
                className="accent-primary w-5 h-5 cursor-pointer"
              />
              Paypal
            </label>
          </fieldset>

          {/* Feedback */}
          {serverError && (
            <p className="mt-6 text-sm font-sans text-accent" role="alert">
              {serverError}
            </p>
          )}

          {/* Order button — filled primary */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full bg-primary text-white font-sans text-sm font-semibold py-3.5 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Placing order…" : "Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
