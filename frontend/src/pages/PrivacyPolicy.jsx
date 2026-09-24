// PLACEHOLDER legal copy — replace with counsel-approved text before launch.
const sections = [
  {
    heading: "1. Who we are",
    body: "Marigo Souvenirs and Gifts (“Marigo”, “we”, “us”) operates this website. This placeholder privacy policy explains, at a high level, how we intend to handle personal data when you browse the site, create an account, place an order, or contact us.",
  },
  {
    heading: "2. Data we collect",
    body: "We may collect details you provide directly (name, email, shipping address, phone number, account credentials), order and cart history, and technical data such as IP address, browser type, and pages viewed. Payment card details are handled by our payment provider and are not stored on our servers.",
  },
  {
    heading: "3. How we use your data",
    body: "We use personal data to process and ship orders, manage accounts, send transactional messages (order confirmations, password resets), respond to contact requests, prevent fraud, and improve the shop. We do not sell your personal data.",
  },
  {
    heading: "4. Cookies and similar technologies",
    body: "We use cookies and local storage for session management (cart and login), preferences, and basic analytics. See our Cookies page for details.",
  },
  {
    heading: "5. Sharing and retention",
    body: "Data is shared only with service providers needed to run the shop (hosting, payment processing, shipping, email). We keep personal data only as long as required for these purposes or by law.",
  },
  {
    heading: "6. Your rights",
    body: "Depending on your jurisdiction, you may request access, correction, deletion, or restriction of your personal data, or object to certain processing. Contact us using the details on the Contact page to exercise these rights.",
  },
  {
    heading: "7. Contact",
    body: "Questions about this policy: use the Contact page or write to us at Bulevardi Epidamn 47, Durrës, Albania.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="max-w-[800px] mx-auto px-6 lg:px-10 py-16 animate-[fadeIn_0.3s_ease-out]">
      <h1 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-4">
        Privacy &amp; Policy
      </h1>
      <p
        className="text-sm font-sans text-accent border border-accent/20 bg-accent/5 rounded-md px-4 py-3 mb-8"
        role="note"
      >
        PLACEHOLDER CONTENT — Generic structure only. Replace with
        lawyer-approved privacy policy text before launch.
      </p>
      <p className="font-sans text-gray-600 leading-relaxed text-[15px] mb-8">
        Last updated: [DATE]. This page describes how we intend to handle
        information on marigo.example. The sections below are a starting
        framework and are not legal advice.
      </p>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
              {s.heading}
            </h2>
            <p className="font-sans text-gray-600 leading-relaxed text-[15px]">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
