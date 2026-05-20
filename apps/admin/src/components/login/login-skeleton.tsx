import {
  Card,
  CardContent,
  CardHeader,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

export function LoginPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Skeleton className="h-6 w-28 mx-auto" />
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
