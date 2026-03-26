export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  children?: NavItem[];
  badge?: number;
}

export interface NavConfig {
  items: NavItem[];
  customOrder?: string[];
}

export interface NavAnalytics {
  id: string;
  itemId: string;
  timestamp: number;
  action: 'click' | 'hover';
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}
