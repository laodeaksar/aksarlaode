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

interface DeactivateUserButtonProps {
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

export function DeactivateUserButton({
  userId,
  userName,
  onSuccess,
}: DeactivateUserButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteCustomerFn({ data: { id: userId } }),

    onSuccess: () => {
      toast.success(`${userName} berhasil dinonaktifkan`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess?.();
    },

    onError: (err) => {
      toast.error("Gagal menonaktifkan pengguna", err);
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
        {isPending ? "Processing..." : "Deactivate"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{userName}</span>&apos;s account
            will be deactivated and all active sessions will be terminated. The
            account data is preserved and can be restored.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => mutate()}>
            Yes, Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
