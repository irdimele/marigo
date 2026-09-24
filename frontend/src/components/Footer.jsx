import { Link } from "react-router-dom";
import { createLucideIcon } from "lucide-react";

const Instagram = createLucideIcon({
  name: "instagram",
  size: 24,
  node: [
    ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5", key: "2e1cvw" }],
    ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z", key: "9exkf1" }],
    ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5", key: "r4j83e" }],
  ],
});

const Facebook = createLucideIcon({
  name: "facebook",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
        key: "1jg4f8",
      },
    ],
  ],
});

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 mt-16">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Information */}
          <div>
            <h4 className="font-sans text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Information
            </h4>
            <ul className="space-y-0">
              <li>
                <Link
                  to="/"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  About us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h4 className="font-sans text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Contact Us
            </h4>
            <ul className="space-y-0">
              <li>
                <a
                  href="tel:+3556800000"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  mobile: +355 68 000 00
                </a>
              </li>
              <li>
                <a
                  href="mailto:marigo@gmail.com"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  email: marigo@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-sans text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Costumer Service
            </h4>
            <ul className="space-y-0">
              <li>
                <Link
                  to="/privacy-policy"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  Privacy &amp; Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="flex items-center min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  Cookies
                </Link>
              </li>
            </ul>
          </div>

          {/* Visit Us */}
          <div>
            <h4 className="font-sans text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Visit Us
            </h4>
            <ul className="space-y-0">
              <li className="flex items-center min-h-[44px] text-sm font-sans text-gray-600">
                Bulevardi Epidamn 47,
              </li>
              <li className="flex items-center min-h-[44px] text-sm font-sans text-gray-600">
                Durrës/Albania
              </li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="font-sans text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Follow Us
            </h4>
            <ul className="space-y-0">
              <li>
                <a
                  href="https://www.instagram.com/marigo_souvenirs/?hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  <Instagram size={16} strokeWidth={1.5} />
                  marigo_souvenirs
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/marigosouvenirsandgifts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-h-[44px] text-sm font-sans text-gray-600 hover:text-primary transition-colors"
                >
                  <Facebook size={16} strokeWidth={1.5} />
                  Marigo Souvenirs &amp; Gifts Shop
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 text-center">
          <p className="text-sm font-sans text-gray-500">
            &copy; {new Date().getFullYear()} Marigo. Made by GridCoding.
          </p>
        </div>
      </div>
    </footer>
  );
}
