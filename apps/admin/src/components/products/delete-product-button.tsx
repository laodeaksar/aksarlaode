import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Product } from "@repo/common";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";

import { deleteProductFn } from "@/server/products";
import { toast } from "@/lib";

interface DeleteProductButtonProps {
  productId: string;
}

export function DeleteProductButton({ productId }: DeleteProductButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteProductFn({ data: { id: productId } }),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const snapshots = queryClient.getQueriesData<{
        items: Product[];
        total: number;
      }>({
        queryKey: ["products"],
      });
      queryClient.setQueriesData<{ items: Product[]; total: number }>(
        { queryKey: ["products"] },
        (old) =>
          old
            ? {
                items: old.items.filter((p) => p.id !== productId),
                total: old.total - 1,
              }
            : old
      );
      return { snapshots };
    },

    onSuccess: () => {
      toast.success("Produk berhasil dihapus");
    },

    onError: (err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key, data)
      );
      toast.error("Gagal menghapus produk", err);
    },

    onSettled: () => {
      // Invalidate all product list queries so every cached page/filter
      // reflects the deletion.
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Remove the deleted product's detail entry entirely — invalidating
      // it would trigger a re-fetch that returns 404.
      queryClient.removeQueries({ queryKey: ["product", productId] });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          aria-label="Delete product"
        >
          {isPending ? "..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
          <AlertDialogDescription>
            Aksi ini tidak bisa dibatalkan. Produk akan dihapus secara permanen
            dari sistem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => mutate()}>
            Ya, Hapus Permanen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
