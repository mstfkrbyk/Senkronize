import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function NotFoundPage(): ReactElement {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sayfa bulunamadı</CardTitle>
          <CardDescription>
            Aradığınız adres mevcut değil veya taşınmış olabilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/dashboard">Panele dön</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
