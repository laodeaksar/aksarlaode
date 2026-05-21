import { useMutation, useQueryClient } from "@tanstack/react-query";

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

import { deleteCustomerFn } from "@/server/customers";
import { toast } from "@/lib";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  onSuccess,
}: DeleteCustomerButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteCustomerFn({ data: { id: customerId } }),

    onSuccess: () => {
      toast.success(`${customerName} berhasil dinonaktifkan`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.removeQueries({ queryKey: ["customer", customerId] });
      onSuccess?.();
    },

    onError: (err) => {
      toast.error("Gagal menonaktifkan customer", err);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            className="w-full justify-start"
          />
        }
      >
        {isPending ? "Memproses..." : "Nonaktifkan"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nonaktifkan Customer</AlertDialogTitle>
          <AlertDialogDescription>
            Akun <span className="font-semibold">{customerName}</span> akan
            dinonaktifkan dan semua sesinya akan langsung dibatalkan. Data akun
            tetap tersimpan dan dapat dipulihkan oleh Owner.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => mutate()}>
            Ya, Nonaktifkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
