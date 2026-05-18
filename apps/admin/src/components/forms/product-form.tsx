import { useForm } from "react-hook-form"

import { effectResolver } from "@/lib"
import { ProductFormSchema, type ProductFormValues } from "@/schemas/forms"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"

interface Props {
  defaultValues?: Partial<ProductFormValues>
  onSubmit: (data: ProductFormValues) => void
  isLoading: boolean
  error: string | null
}

// CONSISTENCY-FIX FORM-01: replaced raw HTML (<input>, <label>, <textarea>,
// <button>) with @repo/ui design-system components — same pattern as login-page.tsx.
export function ProductForm({
  defaultValues = {},
  onSubmit,
  isLoading,
  error,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: effectResolver(ProductFormSchema),
    defaultValues: {
      name:        defaultValues.name        ?? "",
      price:       defaultValues.price       ?? 0,
      stock:       defaultValues.stock       ?? 0,
      sku:         defaultValues.sku         ?? "",
      description: defaultValues.description ?? "",
    },
  })

  const onFormSubmit = handleSubmit((data) =>
    onSubmit({
      ...data,
      name:        data.name.trim(),
      sku:         data.sku.trim(),
      description: data.description?.trim() || "",
    }),
  )

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          {error}
        </p>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="pf-name">Name</FieldLabel>
          <Input
            id="pf-name"
            aria-label="Product name"
            {...register("name")}
          />
          {errors.name && <FieldError errors={[errors.name]} />}
        </Field>

        <Field data-invalid={!!errors.sku}>
          <FieldLabel htmlFor="pf-sku">SKU</FieldLabel>
          <Input
            id="pf-sku"
            aria-label="Product SKU"
            {...register("sku")}
          />
          {errors.sku && <FieldError errors={[errors.sku]} />}
        </Field>

        <Field data-invalid={!!errors.price}>
          <FieldLabel htmlFor="pf-price">Price (IDR)</FieldLabel>
          <Input
            id="pf-price"
            type="number"
            min={1}
            aria-label="Product price"
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price && <FieldError errors={[errors.price]} />}
        </Field>

        <Field data-invalid={!!errors.stock}>
          <FieldLabel htmlFor="pf-stock">Stock</FieldLabel>
          <Input
            id="pf-stock"
            type="number"
            min={0}
            aria-label="Product stock"
            {...register("stock", { valueAsNumber: true })}
          />
          {errors.stock && <FieldError errors={[errors.stock]} />}
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="pf-description">Description</FieldLabel>
          <Textarea
            id="pf-description"
            rows={3}
            aria-label="Product description"
            {...register("description")}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Product"}
      </Button>
    </form>
  )
}
