import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Effect } from "effect";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import type { Product } from "@repo/common";

import { productsApi } from "@/lib/api/products";
import { AppRuntime } from "@/lib/effect/runtime";

const filterSchema = z.object({
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.boolean().optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "popular"]).optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

type Props = {
  initialProducts: Product[];
  total: number;
};

function getUrlParams(): FilterValues {
  if (typeof window === "undefined") return { sortBy: "newest" };
  const p = new URLSearchParams(window.location.search);
  return {
    search: p.get("search") ?? undefined,
    minPrice: p.get("minPrice") ? Number(p.get("minPrice")) : undefined,
    maxPrice: p.get("maxPrice") ? Number(p.get("maxPrice")) : undefined,
    inStock: p.get("inStock") === "true" ? true : undefined,
    sortBy: (p.get("sortBy") as FilterValues["sortBy"]) ?? "newest",
  };
}

function syncToUrl(values: FilterValues) {
  const params = new URLSearchParams();
  if (values.search) params.set("search", values.search);
  if (values.minPrice != null) params.set("minPrice", String(values.minPrice));
  if (values.maxPrice != null) params.set("maxPrice", String(values.maxPrice));
  if (values.inStock) params.set("inStock", "true");
  if (values.sortBy && values.sortBy !== "newest")
    params.set("sortBy", values.sortBy);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function ProductFilters({ initialProducts, total }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [resultTotal, setResultTotal] = useState(total);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: getUrlParams(),
  });

  // Debounced live search
  const searchValue = watch("search");
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSubmit(fetchProducts)();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const fetchProducts = async (values: FilterValues) => {
    setIsLoading(true);

    const exit = await AppRuntime.runPromiseExit(
      productsApi.list({
        search: values.search || undefined,
        minPrice: values.minPrice || undefined,
        maxPrice: values.maxPrice || undefined,
        inStock: values.inStock || undefined,
        sortBy: values.sortBy,
      })
    );

    setIsLoading(false);

    if (exit._tag === "Success") {
      setProducts(exit.value.items);
      setResultTotal(exit.value.total);
      syncToUrl(values);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter form */}
      <form onSubmit={handleSubmit(fetchProducts)} className="space-y-4">
        {/* Search */}
        <input
          {...register("search")}
          className="w-full rounded-lg border px-4 py-2.5 text-sm"
          placeholder="Search products..."
        />

        {/* Price range */}
        <div className="flex items-center gap-3">
          <input
            {...register("minPrice")}
            type="number"
            className={inputCls(!!errors.minPrice)}
            placeholder="Min price"
          />
          <span className="text-gray-400">—</span>
          <input
            {...register("maxPrice")}
            type="number"
            className={inputCls(!!errors.maxPrice)}
            placeholder="Max price"
          />
        </div>

        {/* Sort + In Stock row */}
        <div className="flex items-center gap-3">
          <Controller
            name="sortBy"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="popular">Most Popular</option>
              </select>
            )}
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Controller
              name="inStock"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => {
                    field.onChange(e.target.checked);
                    handleSubmit(fetchProducts)();
                  }}
                  className="h-4 w-4 rounded"
                />
              )}
            />
            In Stock Only
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply Filters
        </button>
      </form>

      {/* Results */}
      <p className="text-sm text-gray-500">{resultTotal} products found</p>

      <div
        className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 ${isLoading ? "pointer-events-none opacity-50" : ""}`}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && !isLoading && (
        <div className="py-16 text-center text-gray-500">
          No products found. Try adjusting your filters.
        </div>
      )}
    </div>
  );
}

function inputCls(invalid: boolean) {
  return `flex-1 rounded-lg border px-3 py-2 text-sm ${invalid ? "border-red-400" : ""}`;
}

function ProductCard({ product }: { product: Product }) {
  const discountPct =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : null;

  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
    >
      {discountPct && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
          -{discountPct}%
        </span>
      )}
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.imageUrls?.[0] ?? "/placeholder.png"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        {discountPct && (
          <p className="text-xs text-gray-400 line-through">
            Rp {product.comparePrice!.toLocaleString("id-ID")}
          </p>
        )}
        <p
          className={`text-sm font-bold ${discountPct ? "text-red-600" : "text-blue-600"}`}
        >
          Rp {product.price.toLocaleString("id-ID")}
        </p>
        {product.stock === 0 && (
          <p className="text-xs font-medium text-red-500">Out of Stock</p>
        )}
      </div>
    </a>
  );
}
