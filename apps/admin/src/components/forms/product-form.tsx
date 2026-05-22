import { Form, useField, useForm } from "@formisch/react";

import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";

import { ProductFormSchema, type ProductFormValues } from "@/schemas/forms";

interface Props {
  defaultValues?: Partial<ProductFormValues>;
  onSubmit: (data: ProductFormValues) => void;
  isLoading: boolean;
  error: string | null;
}

// CONSISTENCY-FIX FORM-01: replaced raw HTML (<input>, <label>, <textarea>,
// <button>) with @repo/ui design-system components — same pattern as login-page.tsx.
export function ProductForm({
  defaultValues = {},
  onSubmit,
  isLoading,
  error,
}: Props) {
  const form = useForm({
    schema: ProductFormSchema,
    initialInput: {
      name: defaultValues.name ?? "",
      price: defaultValues.price ?? 0,
      comparePrice: defaultValues.comparePrice,
      stock: defaultValues.stock ?? 0,
      sku: defaultValues.sku ?? "",
      description: defaultValues.description ?? "",
    },
  });

  const nameField = useField(form, { path: ["name"] as const });
  const skuField = useField(form, { path: ["sku"] as const });
  const priceField = useField(form, { path: ["price"] as const });
  const comparePriceField = useField(form, { path: ["comparePrice"] as const });
  const stockField = useField(form, { path: ["stock"] as const });
  const descriptionField = useField(form, { path: ["description"] as const });

  return (
    <Form
      of={form}
      onSubmit={(data) =>
        onSubmit({
          ...data,
          name: data.name.trim(),
          sku: data.sku.trim(),
          description: data.description.trim(),
        })
      }
      className="space-y-4"
    >
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
        >
          {error}
        </p>
      )}

      <FieldGroup>
        <Field data-invalid={!!nameField.errors}>
          <FieldLabel htmlFor="pf-name">Name</FieldLabel>
          <Input {...nameField.props} id="pf-name" aria-label="Product name" />
          {nameField.errors && (
            <FieldError
              errors={nameField.errors.map((m) => ({ message: m }))}
            />
          )}
        </Field>

        <Field data-invalid={!!skuField.errors}>
          <FieldLabel htmlFor="pf-sku">SKU</FieldLabel>
          <Input {...skuField.props} id="pf-sku" aria-label="Product SKU" />
          {skuField.errors && (
            <FieldError errors={skuField.errors.map((m) => ({ message: m }))} />
          )}
        </Field>

        <Field data-invalid={!!priceField.errors}>
          <FieldLabel htmlFor="pf-price">Price (IDR)</FieldLabel>
          <Input
            {...priceField.props}
            id="pf-price"
            type="number"
            min={1}
            aria-label="Product price"
          />
          {priceField.errors && (
            <FieldError
              errors={priceField.errors.map((m) => ({ message: m }))}
            />
          )}
        </Field>

        <Field data-invalid={!!comparePriceField.errors}>
          <FieldLabel htmlFor="pf-compare-price">
            Compare Price (IDR){" "}
            <span className="text-muted-foreground text-xs font-normal">
              — optional, shown crossed-out as original price
            </span>
          </FieldLabel>
          <Input
            {...comparePriceField.props}
            id="pf-compare-price"
            type="number"
            min={1}
            aria-label="Compare price (original price before discount)"
            placeholder="Leave blank if no sale"
          />
          {comparePriceField.errors && (
            <FieldError
              errors={comparePriceField.errors.map((m) => ({ message: m }))}
            />
          )}
        </Field>

        <Field data-invalid={!!stockField.errors}>
          <FieldLabel htmlFor="pf-stock">Stock</FieldLabel>
          <Input
            {...stockField.props}
            id="pf-stock"
            type="number"
            min={0}
            aria-label="Product stock"
          />
          {stockField.errors && (
            <FieldError
              errors={stockField.errors.map((m) => ({ message: m }))}
            />
          )}
        </Field>

        <Field data-invalid={!!descriptionField.errors}>
          <FieldLabel htmlFor="pf-description">Description</FieldLabel>
          <Textarea
            {...descriptionField.props}
            id="pf-description"
            rows={3}
            aria-label="Product description"
          />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Product"}
      </Button>
    </Form>
  );
}
