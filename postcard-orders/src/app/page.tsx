import OrdersView from "@/components/OrdersView";
import { authDisabled } from "@/lib/auth";
import { getStore, storeKind } from "@/lib/store";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let orders: Order[] = [];
  let lastImportAt: string | null = null;
  let loadError: string | null = null;

  try {
    const store = getStore();
    [orders, lastImportAt] = await Promise.all([store.list(), store.getLastImportAt()]);
  } catch (e) {
    // A bad DATABASE_URL shouldn't render a stack trace — say what to fix.
    loadError = e instanceof Error ? e.message : "לא ניתן לטעון את ההזמנות";
  }

  return (
    <OrdersView
      initialOrders={orders}
      initialLastImportAt={lastImportAt}
      loadError={loadError}
      store={storeKind()}
      authOff={authDisabled()}
    />
  );
}
