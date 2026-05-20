import type { ReactElement } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { MigrationDataType } from '@/types/migration';

import {
  MIGRATION_DATA_TYPES,
  MIGRATION_PLATFORMS,
  type MigrationPlatformId,
} from '../migration.constants';

interface Props {
  selectedPlatform: MigrationPlatformId | null;
  selectedDataTypes: MigrationDataType[];
  onSelectPlatform: (id: MigrationPlatformId) => void;
  onToggleDataType: (id: MigrationDataType, checked: boolean) => void;
}

export function SourceSelectionStep({
  selectedPlatform,
  selectedDataTypes,
  onSelectPlatform,
  onToggleDataType,
}: Props): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Kaynak platform</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verilerinizi taşıdığınız platformu seçin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MIGRATION_PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const selected = selectedPlatform === platform.id;
          return (
            <Card
              key={platform.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                selected ? 'ring-2 ring-accent' : ''
              }`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectPlatform(platform.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPlatform(platform.id);
                }
              }}
            >
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="rounded-lg bg-accent/15 p-2 text-accent">
                  <Icon className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{platform.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {platform.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-medium">Hangi veriler içe aktarılacak?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          En az bir veri tipi seçin. Dosya yükleme adımında öncelikli tip işlenir.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MIGRATION_DATA_TYPES.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                id={`data-type-${item.id}`}
                checked={selectedDataTypes.includes(item.id)}
                onCheckedChange={(checked) =>
                  onToggleDataType(item.id, checked === true)
                }
              />
              <Label htmlFor={`data-type-${item.id}`} className="cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
