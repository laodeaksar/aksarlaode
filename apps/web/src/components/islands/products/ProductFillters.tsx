import { useEffect } from "react";
import { useState } from "react";
import { Form, handleSubmit, useField, useForm } from "@formisch/react";
import * as v from "valibot";

import { Effect } from "effect";

import type { Product } from "@repo/common";

import { productsApi } from "@/lib/api/products";
import { AppRuntime } from "@/lib/effect/runtime";

// Filter schema — inline, all fields optional so the form always submits.
// minPrice/maxPrice are kept as strings because HTML number inputs yield
// string values via the DOM; conversion happens in fetchProducts below.
const filterSchema = v.object({
  search: v.optional(v.string()),
  minPrice: v.optional(v.string()),
  maxPrice: v.optional(v.string()),
  inStock: v.optional(v.boolean()),
  sortBy: v.optional(
    v.picklist(["newest", "price_asc", "price_desc", "popular"] as const)
  ),
});

type FilterFormValues = v.InferOutput<typeof filterSchema>;

type Props = {
  initialProducts: Product[];
  total: number;
};

function getUrlParams(): FilterFormValues {
  if (typeof window === "undefined") return { sortBy: "newest" };
  const p = new URLSearchParams(window.location.search);
  return {
    search: p.get("search") ?? undefined,
    minPrice: p.get("minPrice") ?? undefined,
    maxPrice: p.get("maxPrice") ?? undefined,
    inStock: p.get("inStock") === "true" ? true : undefined,
    sortBy:
      (p.get("sortBy") as FilterFormValues["sortBy"]) ?? "newest",
  };
}

function syncToUrl(values: FilterFormValues) {
  const params = new URLSearchParams();
  if (values.search) params.set("search", values.search);
  if (values.minPrice != null && values.minPrice !== "")
    params.set("minPrice", values.minPrice);
  if (values.maxPrice != null && values.maxPrice !== "")
    params.set("maxPrice", values.maxPrice);
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

  const form = useForm({
    schema: filterSchema,
    initialInput: getUrlParams(),
  });

  // useField for fields that need programmatic access (debounce / immediate submit)
  const searchField = useField(form, { path: ["search"] as const });
  const minPriceField = useField(form, { path: ["minPrice"] as const });
  const maxPriceField = useField(form, { path: ["maxPrice"] as const });
  const sortByField = useField(form, { path: ["sortBy"] as const });
  const inStockField = useField(form, { path: ["inStock"] as const });

  // Debounced live search — re-runs whenever the search field value changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSubmit(form, fetchProducts)();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchField.input]);

  const fetchProducts = async (values: FilterFormValues) => {
    setIsLoading(true);

    // Convert optional price strings to numbers for the API
    const minPriceNum =
      values.minPrice !== undefined && values.minPrice !== ""
        ? parseFloat(values.minPrice)
        : undefined;
    const maxPriceNum =
      values.maxPrice !== undefined && values.maxPrice !== ""
        ? parseFloat(values.maxPrice)
        : undefined;

    const exit = await AppRuntime.runPromiseExit(
      productsApi.list({
        search: values.search || undefined,
        minPrice:
          minPriceNum !== undefined && !isNaN(minPriceNum)
            ? minPriceNum
            : undefined,
        maxPrice:
          maxPriceNum !== undefined && !isNaN(maxPriceNum)
            ? maxPriceNum
            : undefined,
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
      <Form of={form} onSubmit={fetchProducts} className="space-y-4">
        {/* Search */}
        <input
          {...searchField.props}
          className="w-full rounded-lg border px-4 py-2.5 text-sm"
          placeholder="Search products..."
        />

        {/* Price range */}
        <div className="flex items-center gap-3">
          <input
            {...minPriceField.props}
            type="number"
            className={inputCls(!!minPriceField.errors)}
            placeholder="Min price"
          />
          <span className="text-gray-400">—</span>
          <input
            {...maxPriceField.props}
            type="number"
            className={inputCls(!!maxPriceField.errors)}
            placeholder="Max price"
          />
        </div>

        {/* Sort + In Stock row */}
        <div className="flex items-center gap-3">
          {/* sortBy select — use field.onChange for controlled value */}
          <select
            name={sortByField.props.name}
            ref={sortByField.props.ref}
            value={sortByField.input ?? "newest"}
            onChange={(e) =>
              sortByField.onChange(
                e.target.value as FilterFormValues["sortBy"]
              )
            }
            onBlur={sortByField.props.onBlur}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="popular">Most Popular</option>
          </select>

          {/* inStock checkbox — onChange also immediately triggers a fetch */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={inStockField.props.name}
              ref={inStockField.props.ref}
              checked={inStockField.input ?? false}
              onChange={(e) => {
                inStockField.onChange(e.target.checked);
                handleSubmit(form, fetchProducts)();
              }}
              className="h-4 w-4 rounded"
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
      </Form>

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
