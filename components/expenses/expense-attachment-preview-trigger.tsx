"use client";

import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExpenseAttachmentPreviewTriggerProps = {
  onClick?: () => void;
  disabled?: boolean;
};

export function ExpenseAttachmentPreviewTrigger({
  onClick,
  disabled,
}: ExpenseAttachmentPreviewTriggerProps) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <EyeIcon className="size-4" />
      Preview
    </Button>
  );
}
