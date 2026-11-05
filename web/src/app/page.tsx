'use client';

import { DemoApp } from '@/components/DemoApp';
import { ApiProvider } from '@/lib/api/ApiContext';

export default function Page() {
  return (
    <ApiProvider>
      <DemoApp />
    </ApiProvider>
  );
}
