"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [step, setStep] = useState<"FORM" | "OTP">("FORM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register() {
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const res = await fetch(`${API_BASE}/api/email-otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        purpose: "REGISTER"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to send OTP");
      setLoading(false);
      return;
    }

    setStep("OTP");
    setLoading(false);
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);

    const res = await fetch(`${API_BASE}/api/email-otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        otp,
        purpose: "REGISTER"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to verify OTP");
      setLoading(false);
      return;
    }

    setStep("FORM");
    setLoading(false);
  }

  return (
    <div>
      {step === "FORM" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
        >
          <h1>Register</h1>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div>
            <label>
              Email:
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <label>
              Password:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <button type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
          </div>
        </form>
      )}
      {step === "OTP" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyOtp();
          }}
        >
          <h1>Verify OTP</h1>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div>
            <label>
              OTP:
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}