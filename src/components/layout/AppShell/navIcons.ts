import type { ComponentType } from 'react';
import { ChatIcon, DevicesIcon, HomeIcon, MenuIcon } from '@/components/icons';
import type { NavKey } from './navItems';

export const NAV_ICONS: Record<NavKey, ComponentType<{ className?: string }>> = {
  dashboard: HomeIcon,
  devices: DevicesIcon,
  support: ChatIcon,
  more: MenuIcon,
};
