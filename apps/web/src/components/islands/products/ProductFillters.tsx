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
    defaultValues: { sortBy: "newest" },
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
        <div className="flex gap-3 items-center">
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
        <div className="flex gap-3 items-center">
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

          <label className="flex items-center gap-2 text-sm cursor-pointer">
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
        className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 transition-opacity
        ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
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

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={`/products/${product.slug}`}
      className="group block rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.imageUrls?.[0] ?? "/placeholder.png"}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium line-clamp-2">{product.name}</p>
        <p className="text-sm font-bold text-blue-600">
          Rp {product.price.toLocaleString("id-ID")}
        </p>
        {product.comparePrice && (
          <p className="text-xs text-gray-400 line-through">
            Rp {product.comparePrice.toLocaleString("id-ID")}
          </p>
        )}
        {product.stock === 0 && (
          <p className="text-xs text-red-500 font-medium">Out of Stock</p>
        )}
      </div>
    </a>
  );
}
