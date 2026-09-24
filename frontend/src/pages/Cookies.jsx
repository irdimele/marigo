// PLACEHOLDER legal copy — replace with counsel-approved text before launch.
const sections = [
  {
    heading: "1. What cookies are",
    body: "Cookies are small text files stored on your device when you visit a website. Similar technologies (local storage, session storage) work in comparable ways. This placeholder cookie policy outlines how we intend to use them on the Marigo shop.",
  },
  {
    heading: "2. Strictly necessary cookies",
    body: "Required for core shop functions: keeping you signed in, remembering cart contents, protecting against Cross-Site Request Forgery, and balancing traffic. The site cannot work properly without these.",
  },
  {
    heading: "3. Preference cookies",
    body: "Remember choices such as “remember me” so you stay logged in across visits. Disabling them may mean you log in more often.",
  },
  {
    heading: "4. Analytics and performance",
    body: "We may use privacy-respecting analytics to understand aggregate usage (page views, popular products). These help us improve the shop. No advertising profiles are built from this data unless we explicitly add such tools later and update this notice.",
  },
  {
    heading: "5. Managing cookies",
    body: "You can block or delete cookies in your browser settings. Blocking strictly necessary cookies will break login and cart functionality. Browser help pages explain how to manage cookies per site.",
  },
  {
    heading: "6. Updates and contact",
    body: "We may update this notice when our cookie usage changes. For questions, use the Contact page or write to Bulevardi Epidamn 47, Durrës, Albania.",
  },
];

export default function Cookies() {
  return (
    <div className="max-w-[800px] mx-auto px-6 lg:px-10 py-16 animate-[fadeIn_0.3s_ease-out]">
      <h1 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-4">
        Cookies
      </h1>
      <p
        className="text-sm font-sans text-accent border border-accent/20 bg-accent/5 rounded-md px-4 py-3 mb-8"
        role="note"
      >
        PLACEHOLDER CONTENT — Generic structure only. Replace with
        lawyer-approved cookie policy text before launch.
      </p>
      <p className="font-sans text-gray-600 leading-relaxed text-[15px] mb-8">
        Last updated: [DATE]. This page is a starting framework and is not
        legal advice.
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
