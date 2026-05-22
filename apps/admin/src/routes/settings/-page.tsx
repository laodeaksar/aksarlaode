import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";

import { getSettingsFn, updateSettingsFn } from "@/server/settings";
import type { StoreSettings } from "@/effect/Services.schemas";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/page-header";

const DEFAULT_SETTINGS: StoreSettings = {
  paymentExpiryMinutes: 60,
  minimumOrderAmount: 1000,
  maxOrderItemsPerOrder: 50,
  maintenanceMode: false,
};

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: serverSettings } = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => getSettingsFn({}),
    // Settings are only mutated via this page; no need for background polling.
    staleTime: Infinity,
  });

  const [values, setValues] = useState<StoreSettings>(
    serverSettings ?? DEFAULT_SETTINGS
  );

  // Sync local state whenever the server data first arrives (from loader cache).
  useEffect(() => {
    if (serverSettings) setValues(serverSettings);
  }, [serverSettings]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: StoreSettings) => updateSettingsFn({ data }),
    onSuccess: (updated) => {
      setValues(updated);
      queryClient.setQueryData(["store-settings"], updated);
      toast.success(
        "Settings saved. Running services have been notified to reload."
      );
    },
    onError: () => {
      toast.error("Failed to save settings. Please try again.");
    },
  });

  function setField<K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <PageHeader title="Store Settings" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutate(values);
        }}
        className="grid max-w-2xl gap-6"
      >
        {/* ── Order limits ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Order Limits</CardTitle>
            <CardDescription>
              Maximum items per order and minimum order value enforced at
              checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="maxOrderItemsPerOrder">Max Items Per Order</Label>
              <Input
                id="maxOrderItemsPerOrder"
                type="number"
                min={1}
                value={values.maxOrderItemsPerOrder}
                onChange={(e) =>
                  setField(
                    "maxOrderItemsPerOrder",
                    Math.max(1, Number(e.target.value))
                  )
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="minimumOrderAmount">
                Minimum Order Amount (Rp)
              </Label>
              <Input
                id="minimumOrderAmount"
                type="number"
                min={0}
                value={values.minimumOrderAmount}
                onChange={(e) =>
                  setField(
                    "minimumOrderAmount",
                    Math.max(0, Number(e.target.value))
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Payment ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <CardDescription>
              How long customers have to complete payment after placing an
              order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5">
              <Label htmlFor="paymentExpiryMinutes">
                Payment Window (minutes)
              </Label>
              <Input
                id="paymentExpiryMinutes"
                type="number"
                min={1}
                value={values.paymentExpiryMinutes}
                onChange={(e) =>
                  setField(
                    "paymentExpiryMinutes",
                    Math.max(1, Number(e.target.value))
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Maintenance mode ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Mode</CardTitle>
            <CardDescription>
              While enabled, new orders and payments are blocked for all
              customers. Use during deployments or critical incidents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Switch
                id="maintenanceMode"
                checked={values.maintenanceMode}
                onCheckedChange={(checked) =>
                  setField("maintenanceMode", checked)
                }
              />
              <Label htmlFor="maintenanceMode" className="cursor-pointer">
                {values.maintenanceMode ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
