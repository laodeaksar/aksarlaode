import { useEffect } from "react"

interface Props {
  snapToken: string
  onSuccess?: () => void
  onError?:   () => void
}

// FIX W-02: The previous version injected a <script> tag dynamically, causing
// the Midtrans Snap SDK to be loaded twice (checkout.astro also loads it via a
// static <script is:inline> tag).  Double-loading produced a race condition
// where the second SDK initialisation could fire before the first had settled,
// or the cleanup function removed the script while snap.pay() was still running.
//
// The static script in checkout.astro is the single source of truth.
// This component relies on window.snap being present from that static load.

export function PaymentSnap({ snapToken, onSuccess, onError }: Props) {
  useEffect(() => {
    const snap = (window as any).snap

    if (!snap || typeof snap.pay !== "function") {
      console.error("Midtrans Snap SDK not ready — window.snap is not available")
      onError?.()
      return
    }

    snap.pay(snapToken, {
      onSuccess: onSuccess ?? (() => { window.location.href = "/account/orders" }),
      onPending: () => { window.location.href = "/account/orders" },
      onError:   onError   ?? (() => { alert("Payment failed. Please try again.") }),
      onClose:   () => { console.log("Payment modal closed by user") },
    })
  }, [snapToken])

  return (
    <div className="text-center py-8">
      <p className="text-gray-600">Opening payment gateway…</p>
    </div>
  )
}
