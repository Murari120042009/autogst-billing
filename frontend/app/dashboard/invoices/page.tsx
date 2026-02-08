"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";

type Invoice = {
  id: string;
  status: string;
  created_at: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) throw new Error("Not authenticated");

        const { data: businessUser, error } = await supabase
          .from("business_users")
          .select("business_id")
          .eq("user_id", user.id)
          .single();

        if (error || !businessUser) {
          throw new Error("Business not found");
        }

        const businessId = businessUser.business_id;

        const res = await fetch(`${API_BASE}/api/invoices`, {
          headers: {
            "x-business-id": businessId,
          },
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load invoices");
        }

        if (Array.isArray(json)) {
          setInvoices(json);
        } else if (Array.isArray(json.invoices)) {
          setInvoices(json.invoices);
        } else {
          setInvoices([]);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load invoices");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  if (loading) return <p>Loading invoices...</p>;

  return (
    <RequireAuth>
      <div className="container">
        <h1 style={{ textAlign: "center", color: "var(--primary-color)" }}>Invoices</h1>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <a href={`/dashboard/invoices/${inv.id}`} style={{ color: "var(--primary-color)", textDecoration: "none" }}>
                      {inv.id}
                    </a>
                  </td>
                  <td>{inv.status}</td>
                  <td>{new Date(inv.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RequireAuth>
  );
}