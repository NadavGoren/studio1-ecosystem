import OrdersView from "@/components/OrdersView";
import { authDisabled } from "@/lib/auth";
import { getStore, storeKind } from "@/lib/store";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let orders: Order[] = [];
  let lastImportAt: string | null = null;
  let importFile: { filename: string; bytes: number } | null = null;
  let loadError: string | null = null;

  try {
    const store = getStore();
    // Info only — the CSV itself stays in the database until someone asks for it.
    [orders, lastImportAt, importFile] = await Promise.all([
      store.list(),
      store.getLastImportAt(),
      store.getLastImportFileInfo(),
    ]);
  } catch (e) {
    // A bad DATABASE_URL shouldn't render a stack trace — say what to fix.
    loadError = e instanceof Error ? e.message : "לא ניתן לטעון את ההזמנות";
  }

  return (
    <OrdersView
      initialOrders={orders}
      initialLastImportAt={lastImportAt}
      initialImportFile={importFile}
      loadError={loadError}
      store={storeKind()}
      authOff={authDisabled()}
    />
  );
}
