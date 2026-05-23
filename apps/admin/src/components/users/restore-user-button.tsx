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

import { restoreCustomerFn } from "@/server/customers";
import { queryKeys, toast } from "@/lib";

interface RestoreUserButtonProps {
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

export function RestoreUserButton({
  userId,
  userName,
  onSuccess,
}: RestoreUserButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => restoreCustomerFn({ data: { id: userId } }),

    onSuccess: () => {
      toast.success(`Akun ${userName} berhasil dipulihkan`);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
      onSuccess?.();
    },

    onError: (err) => {
      toast.error("Gagal memulihkan akun", err);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            className="w-full justify-start"
          />
        }
      >
        {isPending ? "Processing..." : "Restore"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Account</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{userName}</span>&apos;s account
            will be restored and they will be able to log in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutate()}>
            Yes, Restore
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
