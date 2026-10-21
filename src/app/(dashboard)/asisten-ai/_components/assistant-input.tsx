"use client";

import { ArrowUp, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const MAX_INPUT_CHARS = 4_000;

type AssistantInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
};

/**
 * Input Asisten AI dengan tombol lampiran dan kirim.
 * Tombol "Dokumen" masih berupa kerangka UI; pengiriman pertanyaan sudah aktif.
 */
export function AssistantInput({
  value,
  onChange,
  onSubmit,
  loading = false,
}: AssistantInputProps) {
  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <form
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Input
        type="text"
        name="question"
        aria-label="Pertanyaan untuk Asisten AI"
        placeholder="Tanyakan sesuatu..."
        autoComplete="off"
        maxLength={MAX_INPUT_CHARS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="h-12 rounded-xl pr-12 pl-11 text-base shadow-sm"
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tambah lampiran"
              className="absolute top-1/2 left-1.5 size-8 -translate-y-1/2 rounded-lg text-muted-foreground"
            />
          }
        >
          <Plus />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <FileText />
              Dokumen
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="submit"
        size="icon"
        aria-label="Kirim"
        disabled={!canSubmit}
        className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-lg"
      >
        {loading ? <Spinner className="size-4" /> : <ArrowUp />}
      </Button>
    </form>
  );
}
