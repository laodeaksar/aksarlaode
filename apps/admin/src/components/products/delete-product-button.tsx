import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Product } from "@/effect/Services";
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
  productName: string;
  onSuccess?: () => void;
}

export function DeleteProductButton({
  productId,
  productName,
  onSuccess,
}: DeleteProductButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteProductFn({ data: { id: productId } }),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const snapshots = queryClient.getQueriesData<{
        items: Product[];
        total: number;
      }>({ queryKey: ["products"] });
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
      toast.success(`${productName} berhasil dihapus`);
      onSuccess?.();
    },

    onError: (err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key, data)
      );
      toast.error("Gagal menghapus produk", err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
          className="w-full justify-start"
        >
          {isPending ? "Menghapus..." : "Hapus Produk"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
          <AlertDialogDescription>
            Produk <span className="font-semibold">{productName}</span> akan
            dihapus secara permanen dari sistem. Aksi ini tidak bisa
            dibatalkan.
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
