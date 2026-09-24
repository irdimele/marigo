export default function FormInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  ...props
}) {
  return (
    <div className="w-full">
      <label className="block text-sm font-sans text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={`w-full bg-transparent border-0 border-b-2 px-0 py-2.5 text-[15px] font-sans text-gray-900 outline-none transition-colors placeholder:text-gray-400 ${
          error
            ? "border-accent focus:border-accent"
            : "border-gray-300 focus:border-primary"
        }`}
        {...props}
      />
      {error && (
        <p className="text-accent text-xs font-sans mt-1.5" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
