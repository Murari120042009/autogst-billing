"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      window.location.href = "/onboarding";
    }
  };

  return (
    <div>
      <h1>Login</h1>

      <input
        placeholder="Email"
        suppressHydrationWarning
        onChange={e => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        suppressHydrationWarning
        onChange={e => setPassword(e.target.value)}
      />

      <button onClick={login}>Login</button>

      <p>
        Don’t have an account?{" "}
        <a href="/auth/register">Register</a>
      </p>
    </div>
  );
} 