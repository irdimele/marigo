import { useState } from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { sendContactMessage } from "../api/contact";
import { Skeleton } from "../components/Skeleton";

const MAP_SRC =
  "https://www.google.com/maps?q=Bulevardi%20Epidamn%2047%2C%20Durr%C3%ABs%2C%20Albania&hl=en&z=15&output=embed";

const MAP_LINK =
  "https://www.google.com/maps/dir/?api=1&destination=Bulevardi+Epidamn+47%2C+Durr%C3%ABs%2C+Albania";

const underlineBase =
  "w-full bg-transparent border-0 border-b-2 px-0 py-2.5 text-[15px] font-sans text-gray-900 outline-none transition-colors placeholder:text-gray-400";

function underlineClass(error) {
  return error
    ? `${underlineBase} border-accent focus:border-accent`
    : `${underlineBase} border-gray-900 focus:border-primary`;
}

function fieldError(errors, key) {
  return errors[key] ? (
    <p className="text-accent text-xs font-sans mt-1.5" role="alert">
      {errors[key]}
    </p>
  ) : null;
}

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  function clearFeedback() {
    setServerError("");
    setSuccess("");
  }

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required.";
    else if (name.trim().length < 2) errs.name = "Name is too short.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Enter a valid email address.";
    if (!message.trim()) errs.message = "Message is required.";
    else if (message.trim().length < 10)
      errs.message = "Message is too short (min 10 characters).";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    clearFeedback();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setSuccess("Message sent — we'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
      setErrors({});
    } catch (err) {
      const data = err?.response?.data;
      setServerError(
        (data ? Object.values(data).flat().join(" ") : "") ||
          `Failed to send message: ${err.message}`
      );
      // Map server field errors onto the matching inputs.
      if (data && typeof data === "object") {
        const fieldErrs = {};
        if (data.name) fieldErrs.name = Array.isArray(data.name) ? data.name[0] : data.name;
        if (data.email) fieldErrs.email = Array.isArray(data.email) ? data.email[0] : data.email;
        if (data.message) fieldErrs.message = Array.isArray(data.message) ? data.message[0] : data.message;
        if (Object.keys(fieldErrs).length) setErrors(fieldErrs);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: contact form */}
          <div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 leading-tight max-w-[18ch]">
              We Would Love To Hear From You!
            </h1>
            <p className="font-sans text-gray-500 leading-relaxed text-[15px] mt-4 max-w-[46ch]">
              Lorem ipsum dolor sit amet, tantas ipsum dolor gubegren inciderint
              no his. Cum et dicat discere. Ne petentium incortrupte volutpatlib
              pro, atomorum comprehensam cu mel.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-10">
              {/* Name + Email — side by side desktop, stacked mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFeedback();
                      if (errors.name)
                        setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="Name"
                    aria-label="Name"
                    autoComplete="name"
                    className={underlineClass(errors.name)}
                  />
                  {fieldError(errors, "name")}
                </div>
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFeedback();
                      if (errors.email)
                        setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="Email"
                    aria-label="Email"
                    autoComplete="email"
                    className={underlineClass(errors.email)}
                  />
                  {fieldError(errors, "email")}
                </div>
              </div>

              {/* Message textarea — full width, same underline style.
                  mt-10 matches the spacing above the Name/Email row so all
                  form sections are visually consistent. */}
              <div className="mt-10">
                <textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    clearFeedback();
                    if (errors.message)
                      setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  placeholder="Write your message"
                  aria-label="Write your message"
                  rows={2}
                  maxLength={5000}
                  className={`${underlineClass(errors.message)} resize-none min-h-[64px] pb-1`}
                />
                {fieldError(errors, "message")}
              </div>

              {/* Feedback */}
              {success && (
                <p
                  className="mt-5 text-sm font-sans text-primary"
                  role="status"
                >
                  {success}
                </p>
              )}
              {serverError && (
                <p className="mt-5 text-sm font-sans text-accent" role="alert">
                  {serverError}
                </p>
              )}

              {/* Send — outlined primary */}
              <button
                type="submit"
                disabled={loading}
                className="mt-8 min-h-[44px] px-10 py-2.5 border border-primary text-primary font-sans text-sm font-semibold hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </form>
          </div>

          {/* Right: Google Maps embed */}
          <div className="relative w-full aspect-[4/3] md:aspect-auto md:min-h-[420px] border border-gray-200 overflow-hidden bg-[#f0f0f0]">
            <iframe
              src={MAP_SRC}
              title="Marigo location — Bulevardi Epidamn 47, Durrës, Albania"
              className="absolute inset-0 w-full h-full border-0"
              onLoad={() => setMapLoaded(true)}
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
/>
            {!mapLoaded && (
              <Skeleton className="absolute inset-0" rounded="rounded-none" />
            )}
          </div>
        </div>
      </section>

      {/* Contact info bar */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-16 lg:pb-24">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-4 lg:gap-6">
          <a
            href="mailto:marigo@gmail.com"
            className="flex items-center justify-center gap-3 border border-primary text-primary font-sans text-sm px-6 py-3.5 hover:bg-primary hover:text-white transition-colors"
          >
            <Mail size={18} strokeWidth={1.5} />
            marigo@gmail.com
          </a>
          <a
            href="tel:+3556800000"
            className="flex items-center justify-center gap-3 border border-primary text-primary font-sans text-sm px-6 py-3.5 hover:bg-primary hover:text-white transition-colors"
          >
            <Phone size={18} strokeWidth={1.5} />
            +355 68 000 00
          </a>
          <a
            href={MAP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 border border-primary text-primary font-sans text-sm px-6 py-3.5 hover:bg-primary hover:text-white transition-colors"
          >
            <MapPin size={18} strokeWidth={1.5} />
            Bulevardi Epidamn 47, Durrës/Albania
          </a>
        </div>
      </section>
    </div>
  );
}
