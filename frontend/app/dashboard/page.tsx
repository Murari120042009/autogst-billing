"use client";

import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <RequireAuth>
      <div className="container">
        <h1 style={{ textAlign: "center", color: "var(--primary-color)" }}>Dashboard</h1>
        <p style={{ textAlign: "center", marginBottom: "2rem" }}>Welcome to AutoGST Billing</p>

        <div className="card" style={{ textAlign: "center" }}>
          <h3>Quick Actions</h3>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/dashboard/invoices">
              <button>View Invoices</button>
            </a>
            <a href="/dashboard/upload">
              <button>Upload Invoices</button>
            </a>
          </div>
        </div>

        <div className="card" style={{ textAlign: "center" }}>
          <h3>Account Settings</h3>
          <button onClick={logout}>Logout</button>
        </div>
      </div>
    </RequireAuth>
  );
}