import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";

import { createProductFn } from "@/server/products";
import type { NewProductInput } from "@/effect/Services";
import { ProductForm } from "@/components/forms/product-form";
import { toast } from "@/lib";

export function AddProductDrawer() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NewProductInput) => createProductFn({ data: input }),

    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const cacheKey = ["products", { page: 1, search: "" }];
      const previousData = queryClient.getQueryData<{
        items: { id: string; name: string }[];
        total: number;
      }>(cacheKey);
      queryClient.setQueryData(
        cacheKey,
        (old: typeof previousData) =>
          old
            ? {
                items: [
                  {
                    ...newProduct,
                    id: `optimistic-${Date.now()}`,
                    status: newProduct.status ?? "ACTIVE",
                    imageUrls: newProduct.imageUrls ?? [],
                    createdAt: new Date().toISOString(),
                  },
                  ...old.items,
                ],
                total: old.total + 1,
              }
            : old
      );
      return { previousData, cacheKey };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previousData) {
        queryClient.setQueryData(ctx.cacheKey, ctx.previousData);
      }
      toast.error("Gagal membuat produk", err);
    },

    onSuccess: () => {
      toast.success("Produk berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
    },
  });

  const errorMessage = mutation.error
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "Gagal membuat produk. Silakan coba lagi."
    : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return;
        setOpen(next);
        if (!next) mutation.reset();
      }}
    >
      <SheetTrigger render={<Button />}>+ Tambah Produk</SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tambah Produk</SheetTitle>
          <SheetDescription>
            Isi detail produk baru. Klik Simpan untuk menyimpan ke katalog.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <ProductForm
            onSubmit={(data) =>
              mutation.mutate({
                ...data,
                description: data.description?.trim() || undefined,
              } satisfies NewProductInput)
            }
            isLoading={mutation.isPending}
            error={errorMessage}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
