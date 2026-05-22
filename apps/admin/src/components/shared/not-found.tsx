import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { ArrowUpRightIcon, FolderCodeIcon } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderCodeIcon />
        </EmptyMedia>
        <EmptyTitle>
          {children || <p>The page you are looking for does not exist.</p>}
        </EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any projects yet. Get started by creating
          your first project.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button onClick={() => window.history.back()}>Go back</Button>
        <Button
          variant="outline"
          render={<Link to="/dashboard">Go to Dashboard</Link>}
        />
      </EmptyContent>
      <Button
        variant="link"
        className="text-muted-foreground"
        size="sm"
        nativeButton={false}
        render={
          <a href="#">
            Learn More <ArrowUpRightIcon />
          </a>
        }
      />
    </Empty>
  );
}
