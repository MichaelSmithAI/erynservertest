'use client';

import useSWR from 'swr';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { fetchWithErrorHandlers, fetcher } from '@/lib/utils';
import type { Characters } from '@/lib/db/schema';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';

export default function CharacterEditorPage() {
  const { data: characters, mutate } = useSWR<Array<Characters>>(
    '/api/characters',
    fetcher,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: Characters | null = useMemo(
    () => (characters ?? []).find((c) => c.id === selectedId) ?? null,
    [characters, selectedId],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterCard, setCharacterCard] = useState('');
  const [parsedCard, setParsedCard] = useState<any>(null);
  const [cardFields, setCardFields] = useState<Record<string, any>>({});
  const [isBusy, setIsBusy] = useState(false);

  const resetFormFrom = useCallback((c: Characters) => {
    setName(c.name ?? '');
    setDescription(c.description ?? '');
    setCharacterCard(c.characterCard ?? '');
  }, []);

  // Parse characterCard JSON and create flat field structure
  useEffect(() => {
    if (characterCard) {
      try {
        const parsed = JSON.parse(characterCard);
        setParsedCard(parsed);

        // Flatten the nested structure into dot-notation keys for easy input mapping
        const flatten = (obj: any, prefix = ''): Record<string, any> => {
          const result: Record<string, any> = {};

          for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              Object.assign(result, flatten(value, newKey));
            } else {
              result[newKey] = value;
            }
          }

          return result;
        };

        setCardFields(flatten(parsed));
      } catch (e) {
        setParsedCard(null);
        setCardFields({});
      }
    } else {
      setParsedCard(null);
      setCardFields({});
    }
  }, [characterCard]);

  useEffect(() => {
    if (selected) {
      resetFormFrom(selected);
    }
  }, [selected, resetFormFrom]);

  useEffect(() => {
    if (!selectedId && characters && characters.length > 0) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  const onChangeSelection = (id: string) => {
    setSelectedId(id);
  };

  // Reconstruct nested JSON from flat fields
  const reconstructJSON = useCallback((): string => {
    const unflatten = (flat: Record<string, any>): any => {
      const result: any = {};

      for (const [key, value] of Object.entries(flat)) {
        const keys = key.split('.');
        let current = result;

        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
      }

      return result;
    };

    return JSON.stringify(unflatten(cardFields), null, 2);
  }, [cardFields]);

  const handleUpdate = async () => {
    if (!selected) return;
    if (Object.keys(cardFields).length === 0) {
      toast({
        type: 'error',
        description: 'No character card data to update.',
      });
      return;
    }

    setIsBusy(true);
    try {
      const reconstructedCard = reconstructJSON();
      const res = await fetchWithErrorHandlers('/api/characters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          name,
          description,
          characterCard: reconstructedCard,
        }),
      });
      const updated = await res.json();
      await mutate(
        (prev) =>
          (prev ?? []).map((c) =>
            c.id === updated.id ? { ...c, ...updated } : c,
          ),
        { revalidate: true },
      );
      toast({ type: 'success', description: 'Character updated.' });
    } catch (e) {
      toast({ type: 'error', description: 'Failed to update character.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleClone = async () => {
    if (Object.keys(cardFields).length === 0) {
      toast({
        type: 'error',
        description: 'No character card data to clone.',
      });
      return;
    }

    setIsBusy(true);
    try {
      const reconstructedCard = reconstructJSON();
      const res = await fetchWithErrorHandlers('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone',
          sourceCharacterId: selected?.id ?? '',
          overrides: { name, description, characterCard: reconstructedCard },
        }),
      });
      const created = await res.json();
      await mutate();
      setSelectedId(created.id);
      toast({ type: 'success', description: 'Character cloned.' });
    } catch (e) {
      toast({ type: 'error', description: 'Failed to clone character.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateNew = async () => {
    if (Object.keys(cardFields).length === 0) {
      toast({
        type: 'error',
        description: 'No character card data to create.',
      });
      return;
    }

    if (!name.trim()) {
      toast({ type: 'error', description: 'Name is required.' });
      return;
    }
    if (!description.trim()) {
      toast({ type: 'error', description: 'Description is required.' });
      return;
    }

    setIsBusy(true);
    try {
      const reconstructedCard = reconstructJSON();
      const res = await fetchWithErrorHandlers('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          description,
          characterCard: reconstructedCard,
        }),
      });
      const created = await res.json();
      await mutate();
      setSelectedId(created.id);
      toast({ type: 'success', description: 'New character created.' });
    } catch (e) {
      toast({ type: 'error', description: 'Failed to create character.' });
    } finally {
      setIsBusy(false);
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Handle field value changes
  const handleFieldChange = (key: string, value: any) => {
    setCardFields((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      // Also update the raw characterCard to keep it in sync
      try {
        const unflatten = (flat: Record<string, any>): any => {
          const result: any = {};
          for (const [k, v] of Object.entries(flat)) {
            const keys = k.split('.');
            let current = result;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) {
                current[keys[i]] = {};
              }
              current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = v;
          }
          return result;
        };
        setCharacterCard(JSON.stringify(unflatten(updated), null, 2));
      } catch (e) {
        // Keep existing characterCard if reconstruction fails
      }
      return updated;
    });
  };

  // Render dynamic input fields based on field type
  const renderFieldInput = (key: string, value: any) => {
    const fieldId = `field-${key.replace(/\./g, '-')}`;

    if (Array.isArray(value)) {
      return (
        <div key={key} className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {key}
          </label>
          <Textarea
            id={fieldId}
            className="min-h-[100px]"
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(key, parsed);
              } catch {
                // Allow invalid JSON while typing
                handleFieldChange(key, e.target.value);
              }
            }}
            placeholder="Array (JSON format)"
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      if (value.length > 100) {
        return (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={fieldId} className="text-sm font-medium">
              {key}
            </label>
            <Textarea
              id={fieldId}
              className="min-h-[80px]"
              value={value}
              onChange={(e) => handleFieldChange(key, e.target.value)}
            />
          </div>
        );
      }

      return (
        <div key={key} className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {key}
          </label>
          <Input
            id={fieldId}
            value={value}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={key} className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {key}
          </label>
          <Input
            id={fieldId}
            type="number"
            value={value}
            onChange={(e) =>
              handleFieldChange(key, Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {key}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={fieldId}
              type="checkbox"
              checked={value}
              onChange={(e) => handleFieldChange(key, e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">{value ? 'True' : 'False'}</span>
          </div>
        </div>
      );
    }

    // Fallback for other types
    return (
      <div key={key} className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {key}
        </label>
        <Textarea
          id={fieldId}
          className="min-h-[80px]"
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleFieldChange(key, parsed);
            } catch {
              handleFieldChange(key, e.target.value);
            }
          }}
          placeholder="Value (JSON format)"
        />
      </div>
    );
  };

  const handleDelete = async () => {
    if (!selected) return;

    setIsBusy(true);
    try {
      const res = await fetchWithErrorHandlers(
        `/api/characters?id=${encodeURIComponent(selected.id)}`,
        {
          method: 'DELETE',
        },
      );
      const deleted = await res.json();
      await mutate((prev) => (prev ?? []).filter((c) => c.id !== deleted.id), {
        revalidate: true,
      });
      // pick next selection
      const next = (characters ?? []).find((c) => c.id !== deleted.id) || null;
      setSelectedId(next ? next.id : null);
      if (!next) {
        setName('');
        setDescription('');
        setCharacterCard('');
      }
      toast({ type: 'success', description: 'Character deleted.' });
    } catch (e) {
      toast({ type: 'error', description: 'Failed to delete character.' });
    } finally {
      setIsBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Character Manager</h1>
      <Link
        className="text-sm font-semibold text-pink-500 text-muted-foreground"
        href="/"
      >
        Back to Home
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Characters</div>
          <div className="border rounded-md divide-y overflow-hidden">
            {(characters ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChangeSelection(c.id)}
                className={`text-left p-3 w-full hover:bg-accent ${
                  selectedId === c.id ? 'bg-accent' : ''
                }`}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {c.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="character-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="character-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="character-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Input
                id="character-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Character Card Fields</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (parsedCard) {
                    setCharacterCard(JSON.stringify(parsedCard, null, 2));
                  }
                }}
                disabled={!parsedCard}
              >
                Reset to Original
              </Button>
            </div>

            {Object.keys(cardFields).length > 0 ? (
              <div className="max-h-[600px] overflow-y-auto border rounded-md p-4 space-y-4">
                {Object.entries(cardFields).map(([key, value]) => (
                  <div key={key}>{renderFieldInput(key, value)}</div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="character-card-raw"
                  className="text-sm font-medium"
                >
                  Character Card (JSON)
                </label>
                <Textarea
                  id="character-card-raw"
                  className="min-h-[300px] font-mono"
                  value={characterCard}
                  onChange={(e) => setCharacterCard(e.target.value)}
                  placeholder="Paste character card JSON here"
                />
                {!parsedCard && characterCard && (
                  <p className="text-sm text-destructive">
                    Invalid JSON. Please check your syntax.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleUpdate} disabled={!selected || isBusy}>
              Update Selected
            </Button>
            <Button variant="secondary" onClick={handleClone} disabled={isBusy}>
              Clone as New
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateNew}
              disabled={isBusy}
            >
              Create New
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!selected || isBusy}>
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this character?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the character {selected?.name}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
