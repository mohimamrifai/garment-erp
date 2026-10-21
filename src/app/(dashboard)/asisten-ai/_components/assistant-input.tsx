"use client";

import { ArrowUp, FileText, Image as ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/**
 * Input Asisten AI dengan tombol lampiran dan kirim.
 * Aksi tombol belum terhubung ke backend; hanya kerangka UI.
 */
export function AssistantInput() {
  return (
    <div className="relative w-full">
      <Input
        type="text"
        name="question"
        aria-label="Pertanyaan untuk Asisten AI"
        placeholder="Tanyakan sesuatu..."
        autoComplete="off"
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
            <DropdownMenuItem>
              <ImageIcon />
              Gambar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MoreHorizontal />
              Lainnya
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        size="icon"
        aria-label="Kirim"
        className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-lg"
      >
        <ArrowUp />
      </Button>
    </div>
  );
}
