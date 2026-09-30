export function Skeleton({ className = "", rounded = "rounded" }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

function ProductCardSkeleton() {
  return (
    <div className="block">
      <Skeleton className="aspect-square w-full" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-3/4" rounded="rounded" />
        <Skeleton className="h-4 w-1/4" rounded="rounded" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex flex-col md:flex-row gap-10">
        <Skeleton className="w-full md:w-1/2 aspect-square" />
        <div className="w-full md:w-1/2 flex flex-col justify-center space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <div className="flex gap-2 pt-4">
            <Skeleton className="w-7 h-7 rounded-full" />
            <Skeleton className="w-7 h-7 rounded-full" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-6 w-8" />
          </div>
          <Skeleton className="h-11 w-36 mt-4 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <Skeleton className="h-8 w-24 mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg">
            <Skeleton className="w-20 h-20 flex-shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/5" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>
    </div>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <Skeleton className="h-8 w-28 mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
