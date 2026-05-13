import { useEffect } from "react"

interface Props {
  snapToken: string
  onSuccess?: () => void
  onError?:   () => void
}

export function PaymentSnap({ snapToken, onSuccess, onError }: Props) {
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js"
    script.setAttribute("data-client-key", import.meta.env.PUBLIC_MIDTRANS_CLIENT_KEY ?? "")
    script.onload = () => {
      (window as any).snap.pay(snapToken, {
        onSuccess:  onSuccess ?? (() => window.location.href = "/account/orders"),
        onPending:  () => window.location.href = "/account/orders",
        onError:    onError   ?? (() => alert("Payment failed")),
        onClose:    () => console.log("Payment modal closed"),
      })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [snapToken])

  return (
    <div class="text-center py-8">
      <p class="text-gray-600">Redirecting to payment gateway...</p>
    </div>
  )
}
