type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, error, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition
   focus:ring-2 focus:ring-blue-500
   ${
     hasError
       ? "border-red-400 bg-red-50 focus:ring-red-400"
       : "border-gray-300 bg-white focus:border-blue-500"
   }`;
