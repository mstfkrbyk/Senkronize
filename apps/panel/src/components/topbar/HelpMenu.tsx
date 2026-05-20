import type { ReactElement } from 'react';
import { BookOpen, CircleHelp, FileText, LifeBuoy, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DOCS_URL = 'https://docs.senkronize.com';
const VIDEO_URL = 'https://docs.senkronize.com/video';
const FAQ_URL = 'https://docs.senkronize.com/sss';

export function HelpMenu(): ReactElement {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 font-semibold text-muted-foreground"
          aria-label="Yardım menüsü"
        >
          <CircleHelp className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Yardım</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/support')}>
          <LifeBuoy className="mr-2 size-4" aria-hidden />
          Destek Talebi Oluştur
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            <BookOpen className="mr-2 size-4" aria-hidden />
            Dokümantasyon →
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
            <Video className="mr-2 size-4" aria-hidden />
            Video Rehberler →
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={FAQ_URL} target="_blank" rel="noopener noreferrer">
            <FileText className="mr-2 size-4" aria-hidden />
            Sık Sorulan Sorular →
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
