import { Link } from "react-router-dom";
import whoWeAreImg from "../assets/whoweare.png";
import souvenirImg from "../assets/Rectangle 149 (1).png";
import clothingImg from "../assets/Hanging_T-Shirt_Mockup 8 1 (1).png";
import accessoriesImg from "../assets/Hanging_T-Shirt_Mockup 8 7.png";

// Swap any image by changing the import/path on one line.
const shopCards = [
  {
    label: "Souvenirs",
    image: souvenirImg,
    to: "/shop?category=souvenirs",
  },
  {
    label: "Clothing",
    image: clothingImg,
    to: "/shop?category=clothing",
  },
  {
    label: "Accessories",
    image: accessoriesImg,
    to: "/shop?category=accessories",
  },
];

// TODO: Replace with real brand copy before launch.
const placeholderCopy =
  "Lorem ipsum dolor sit amet, tantas ipsum dolor gubegren inciderint no his. Lorem ipsum dolor sit amet, tantas ipsum gubegren inciderint no his. Cum et dicat discere. Ne petentium incortrupte volutpatlib pro, atomorum comprehensam cu mel.";

export default function About() {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Who We Are */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Container matches the asset's natural ratio (752×472 ≈ 1.59:1)
              so object-cover fills edge-to-edge with zero cropping. */}
          <div className="bg-[#f0f0f0] aspect-[752/472] overflow-hidden border-0 outline-none">
            <img
              src={whoWeAreImg}
              alt="Marigo tote bags"
              className="w-full h-full object-cover object-center border-0 outline-none"
              loading="lazy"
            />
          </div>
          <div>
            <h1 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-5">
              Who We Are
            </h1>
            <p className="font-sans text-gray-600 leading-relaxed text-[15px]">
              {placeholderCopy}
            </p>
          </div>
        </div>
      </section>

      {/* Visit Our Shop */}
      <section className="pb-16 lg:pb-24">
        <div className="max-w-[800px] mx-auto px-6 lg:px-10 text-center mb-10">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-gray-900 mb-5">
            Visit Our Shop
          </h2>
          <p className="font-sans text-gray-600 leading-relaxed text-[15px]">
            {placeholderCopy}
          </p>
        </div>

        {/* 3-column cards — same container/margins as the Who We Are section */}
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {shopCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="group relative block bg-[#d9d9d9] aspect-[4/3] overflow-hidden border-0 outline-none"
              aria-label={`Shop ${card.label}`}
            >
              <img
                src={card.image}
                alt={card.label}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] border-0 outline-none"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <span className="absolute inset-x-0 bottom-0 p-4 font-display text-xl font-semibold text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-y-0 md:translate-y-1 md:group-hover:translate-y-0 transition-all duration-300">
                {card.label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
