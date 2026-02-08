"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { API_BASE } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type InvoiceVersion = {
  version_number: number;
  created_at: string;
  data_snapshot: any;
  file_url?: string;
};

function recalc(data: any) {
  const items = data.items.map((item: any) => ({
    ...item,
    amount: Number(item.quantity) * Number(item.rate)
  }));

  const subtotal = items.reduce(
    (sum: number, i: any) => sum + i.amount,
    0
  );

  const cgst = data.taxes?.cgst?.rate
    ? subtotal * (data.taxes.cgst.rate / 100)
    : 0;

  const sgst = data.taxes?.sgst?.rate
    ? subtotal * (data.taxes.sgst.rate / 100)
    : 0;

  const igst = data.taxes?.igst?.rate
    ? subtotal * (data.taxes.igst.rate / 100)
    : 0;

  return {
    ...data,
    items,
    totals: {
      ...data.totals,
      subtotal,
      grand_total: Math.round(subtotal + cgst + sgst + igst)
    },
    taxes: {
      cgst: data.taxes?.cgst ? { ...data.taxes.cgst, amount: cgst } : undefined,
      sgst: data.taxes?.sgst ? { ...data.taxes.sgst, amount: sgst } : undefined,
      igst: data.taxes?.igst ? { ...data.taxes.igst, amount: igst } : undefined
    }
  };
}

function recalcInvoice(data: any) {
  const items = data.items.map((item: any) => ({
    ...item,
    amount: Number(item.quantity) * Number(item.rate),
  }));

  const subtotal = items.reduce((sum: number, i: any) => sum + i.amount, 0);

  const cgst = data.taxes?.cgst?.rate ? subtotal * (data.taxes.cgst.rate / 100) : 0;
  const sgst = data.taxes?.sgst?.rate ? subtotal * (data.taxes.sgst.rate / 100) : 0;
  const igst = data.taxes?.igst?.rate ? subtotal * (data.taxes.igst.rate / 100) : 0;

  return {
    ...data,
    items,
    totals: {
      subtotal,
      cgst,
      sgst,
      igst,
      total: subtotal + cgst + sgst + igst,
    },
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;

  const [version, setVersion] = useState<InvoiceVersion | null>(null);
  const [data, setData] = useState<any>(null);
  const [editableData, setEditableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchInvoice() {
      const res = await fetch(`${API_BASE}/api/invoices/${invoiceId}`);
      const json = await res.json();
      setVersion(json);
      setData(json.data_snapshot);
      setEditableData(json.data_snapshot); // Initialize editableData
      setLoading(false);
    }
    fetchInvoice();
  }, [invoiceId]);

  async function save() {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const res = await fetch(
      `${API_BASE}/api/invoices/${invoiceId}/correct`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          correctedData: data
        })
      }
    );

    if (res.ok) {
      alert("Saved");
      setEditing(false);
    } else {
      alert("Save failed");
    }
    setSaving(false);
  }

  if (loading || !version || !data) return <p>Loading invoice...</p>;

  const d = data;
  const fileUrl = version.file_url;

  return (
    <RequireAuth>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 24 }}>
        {/* LEFT */}
        <div style={{ border: "1px solid #ccc", padding: 12, background: "#fafafa" }}>
          <h3>Original Bill</h3>
          {fileUrl?.endsWith(".pdf") && <iframe src={fileUrl} width="100%" height="600" />}
          {fileUrl && !fileUrl.endsWith(".pdf") && <img src={fileUrl} style={{ width: "100%" }} />}
        </div>

        {/* RIGHT */}
        <div style={{ border: "1px solid #ccc", padding: 24, background: "#fff" }}>
          <h2 style={{ textAlign: "center" }}>
            <input
              value={d.seller?.name}
              disabled={!editing}
              onChange={e => setData({ ...d, seller: { ...d.seller, name: e.target.value } })}
            />
          </h2>

          <p style={{ textAlign: "center" }}>
            <input
              value={d.seller?.address}
              disabled={!editing}
              onChange={e => setData({ ...d, seller: { ...d.seller, address: e.target.value } })}
            />
          </p>

          <p style={{ textAlign: "center" }}>
            GSTIN:
            <input
              value={d.seller?.gstin}
              disabled={!editing}
              onChange={e => setData({ ...d, seller: { ...d.seller, gstin: e.target.value } })}
            />
          </p>

          <hr />

          <table width="100%" border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Particulars</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
          <tbody>
  {Array.isArray(d.items) &&
    d.items.map((item: any, i: number) => (
      <tr key={i}>
        <td>{i + 1}</td>

        <td>
          {editing ? (
            <input
              value={item.name}
              onChange={e => {
                const items = [...d.items];
                items[i].name = e.target.value;
                setEditableData({ ...d, items });
              }}
            />
          ) : (
            item.name
          )}
        </td>

        <td>
          {editing ? (
            <input
              value={item.hsn}
              onChange={e => {
                const items = [...d.items];
                items[i].hsn = e.target.value;
                setEditableData({ ...d, items });
              }}
            />
          ) : (
            item.hsn
          )}
        </td>

        <td>
          {editing ? (
            <input
              type="number"
              value={item.quantity}
              onChange={e => {
                const items = [...d.items];
                items[i].quantity = Number(e.target.value);
                setEditableData(recalcInvoice({ ...d, items }));
              }}
              style={{ width: 60 }}
            />
          ) : (
            `${item.quantity} ${item.unit}`
          )}
        </td>

        <td>
          {editing ? (
            <input
              type="number"
              value={item.rate}
              onChange={e => {
                const items = [...d.items];
                items[i].rate = Number(e.target.value);
                setEditableData(recalcInvoice({ ...d, items }));
              }}
              style={{ width: 80 }}
            />
          ) : (
            item.rate
          )}
        </td>

        <td>{item.amount}</td>
      </tr>
    ))}
</tbody>
          </table>

          <div style={{ textAlign: "right" }}>
           <p>Subtotal: ₹{d.totals?.subtotal ?? 0}</p>
           <p>CGST: ₹{d.taxes?.cgst?.amount ?? 0}</p>
           <p>SGST: ₹{d.taxes?.sgst?.amount ?? 0}</p>
           <p>IGST: ₹{d.taxes?.igst?.amount ?? 0}</p>
           <h3>Grand Total: ₹{d.totals?.grand_total ?? 0}</h3>
          </div>

          <div style={{ textAlign: "right", marginTop: 16 }}>
            {!editing ? (
              <button onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <button disabled={saving} onClick={save}>
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}