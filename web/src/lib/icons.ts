import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleUserRound,
  Clock,
  Flag,
  Home,
  Info,
  LogOut,
  Plus,
  QrCode,
  Receipt,
  Search,
  Tag,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

/**
 * Semantic icon registry, mirroring the native app's constants/icons.ts --
 * feature code asks for Icons.friend, never a raw lucide import directly,
 * so the mapping stays swappable in one place. lucide-react's outline style
 * was picked specifically because it reads as the closest web equivalent to
 * native's Ionicons outline family (see DESIGN_SYSTEM.md).
 */
export const Icons = {
  home: Home,
  groups: Users,
  friends: UserPlus,
  activity: Clock,
  account: CircleUserRound,
  currency: Tag,
  bet: Flag,
  obligations: Receipt,
  balances: ArrowLeftRight,
  add: Plus,
  back: ChevronLeft,
  forward: ChevronRight,
  close: X,
  check: Check,
  checkCircle: CheckCircle2,
  search: Search,
  warning: AlertTriangle,
  info: Info,
  danger: AlertCircle,
  block: Ban,
  qrCode: QrCode,
  leave: LogOut,
  archive: Archive,
  remove: Trash2,
  emptyDot: Circle,
} as const;

export type IconName = keyof typeof Icons;
