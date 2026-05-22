import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { SendIcon } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { resendEmailFn, type ResendEmailType } from "@/server/queue";
import { toast } from "@/lib";

const EMAIL_TYPE_OPTIONS: {
  value: ResendEmailType;
  label: string;
  description: string;
}[] = [
  {
    value: "order-created",
    label: "Order Placed",
    description: "Sent when an order is first created",
  },
  {
    value: "order-confirmation",
    label: "Payment Confirmed",
    description: "Sent after payment is successfully processed",
  },
  {
    value: "order-cancelled",
    label: "Order Cancelled",
    description: "Sent when an order is cancelled",
  },
];

function isValidEmail(value: string): boolean {
  return value.includes("@") && value.includes(".");
}

export function ResendEmailDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [emailType, setEmailType] = useState<ResendEmailType | "">("");
  const [orderId, setOrderId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [reason, setReason] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      resendEmailFn({
        data: {
          orderId: orderId.trim(),
          emailType: emailType as ResendEmailType,
          recipientEmail: recipientEmail.trim(),
          ...(emailType === "order-cancelled"
            ? { reason: reason.trim() || "Cancelled by admin" }
            : {}),
        },
      }),

    onSuccess: () => {
      toast.success("Email job queued successfully");
      void queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-failed-jobs"] });
      setOpen(false);
      resetForm();
    },

    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to queue email";
      toast.error(message);
    },
  });

  function resetForm() {
    setEmailType("");
    setOrderId("");
    setRecipientEmail("");
    setReason("");
  }

  const isValid =
    emailType !== "" &&
    orderId.trim().length > 0 &&
    isValidEmail(recipientEmail.trim()) &&
    (emailType !== "order-cancelled" || reason.trim().length > 0);

  const selectedOption = EMAIL_TYPE_OPTIONS.find((o) => o.value === emailType);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <SendIcon className="mr-2 h-4 w-4" />
        Resend Email
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Resend Email</DialogTitle>
          <DialogDescription>
            Manually queue a one-off email for an existing order. The job will
            be processed by the email worker immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email type */}
          <div className="space-y-1.5">
            <Label htmlFor="resend-type">Email type</Label>
            <Select
              value={emailType}
              onValueChange={(v) => setEmailType(v as ResendEmailType)}
            >
              <SelectTrigger id="resend-type" className="w-full">
                <SelectValue placeholder="Select email type…" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPE_OPTIONS.map(({ value, label, description }) => (
                  <SelectItem key={value} value={value}>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      — {description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOption && (
              <p className="text-muted-foreground text-xs">
                {selectedOption.description}
              </p>
            )}
          </div>

          {/* Order ID */}
          <div className="space-y-1.5">
            <Label htmlFor="resend-order">Order ID</Label>
            <Input
              id="resend-order"
              type="text"
              placeholder="e.g. ord_abc123"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Recipient email */}
          <div className="space-y-1.5">
            <Label htmlFor="resend-email">Recipient email</Label>
            <Input
              id="resend-email"
              type="email"
              placeholder="customer@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Cancellation reason — only for order-cancelled */}
          {emailType === "order-cancelled" && (
            <div className="space-y-1.5">
              <Label htmlFor="resend-reason">
                Cancellation reason{" "}
                <span className="text-muted-foreground font-normal">
                  (required)
                </span>
              </Label>
              <Input
                id="resend-reason"
                type="text"
                placeholder="e.g. Out of stock"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={isPending || !isValid}>
            {isPending ? "Queueing…" : "Queue Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
