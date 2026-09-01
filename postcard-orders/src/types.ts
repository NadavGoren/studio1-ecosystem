import type { Kind, Service, Status } from "@/lib/domain";

export interface OrderItem {
  name: string;
  qty: number;
}

/** One merged order — all Morning line rows sharing a מספר הזמנה, collapsed. */
export interface Order {
  orderId: string;
  orderDate: string;
  /** Morning's own order status (חדשה / בטיפול / …), kept for reference. */
  sourceStatus: string;
  customer: string;
  phone: string;
  email: string;

  methodRaw: string;
  kind: Kind;
  /** null for pickup orders. */
  service: Service | null;
  /** Where to collect, for pickup orders. */
  pickupPoint: string;

  addressRaw: string;
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  zip: string;
  city: string;
  addrWarnings: string[];
  addrBlocking: boolean;

  qty: number;
  totalIls: number;
  items: OrderItem[];
  noteOrder: string;
  noteShip: string;

  /** Our own workflow status — never overwritten by a re-import. */
  status: Status;
  statusAt: string | null;
  /** Free-text note Nadav or his partner add in the app. */
  note: string;
  updatedAt: string;
}

export interface ImportReport {
  parsedRows: number;
  orders: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Orders whose quantity changed such that they flip between דואר 24 and דואר 72. */
  serviceChanges: { orderId: string; from: Service | null; to: Service | null }[];
  problems: number;
}
