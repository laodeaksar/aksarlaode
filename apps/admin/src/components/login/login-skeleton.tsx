import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

export function LoginPageSkeleton() {
  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Skeleton className="mx-auto h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-9 w-full" />
            </div>
            {/* Password field */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          {/* Submit button */}
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
