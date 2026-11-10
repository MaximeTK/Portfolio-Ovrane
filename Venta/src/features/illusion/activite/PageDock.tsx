'use client';

import type { ComponentProps } from 'react';
import { Dock } from '../dock/Dock';
import { Activite } from './Activite';

// Une page d'Illusion : son dock, avec l'Activité toujours en première fenêtre
export function PageDock({ children, ...dock }: ComponentProps<typeof Dock>) {
  return (
    <Dock {...dock}>
      <Activite />
      {children}
    </Dock>
  );
}
