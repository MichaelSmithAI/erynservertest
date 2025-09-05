'use client';

import useSWR from 'swr';
import { memo, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetcher, cn } from '@/lib/utils';
import type { Characters } from '@/lib/db/schema';
import { CheckCircleFillIcon, ChevronDownIcon } from './icons';

export function CharacterSelector({
  selectedCharacterId,
  onSelect,
  disabled,
  className,
}: {
  selectedCharacterId: string | null;
  onSelect: (character: Characters | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { data: characters } = useSWR<Array<Characters>>(
    '/api/characters',
    fetcher,
  );

  const [open, setOpen] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);

  const selected = useMemo(
    () => characters?.find((c) => c.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId],
  );

  useEffect(() => {
    if (selected?.name) {
      setOptimisticName(selected.name);
    }
  }, [selected?.name]);

  useEffect(() => {
    if (!selectedCharacterId && characters && characters.length > 0) {
      const first = characters[0];
      onSelect(first);
      setOptimisticName(first.name);
    }
    // run when characters load or selected id changes
  }, [characters, selectedCharacterId, onSelect]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit max-w-[100px] data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          variant="outline"
          className="text-[8px] justify-start pl-1 pr-0 overflow-hidden"
          disabled={disabled}
        >
          {selected?.name || optimisticName || 'Select character'}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[300px]">
        {(characters ?? []).map((c) => (
          <DropdownMenuItem
            key={c.id}
            data-active={c.id === selectedCharacterId}
            asChild
          >
            <button
              type="button"
              className="gap-4 group/item flex flex-row justify-between items-center w-full"
              onClick={() => {
                setOpen(false);
                onSelect(c);
                setOptimisticName(c.name);
              }}
            >
              <div className="flex flex-col gap-1 items-start">
                <div>{c.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {c.description}
                </div>
              </div>
              <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                <CheckCircleFillIcon />
              </div>
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(CharacterSelector);
