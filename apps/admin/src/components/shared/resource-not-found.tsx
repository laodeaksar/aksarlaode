import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";

interface ResourceNotFoundProps {
  icon: ReactNode;
  title: string;
  description?: string;
  backTo: string;
  backLabel?: string;
}

export function ResourceNotFound({
  icon,
  title,
  description,
  backTo,
  backLabel = "Kembali ke daftar",
}: ResourceNotFoundProps) {
  return (
    <Empty className="py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Kembali
        </Button>
        <Button render={<Link to={backTo} />}>{backLabel}</Button>
      </EmptyContent>
    </Empty>
  );
}
