"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import RequireAuth from "@/components/RequireAuth";

export default function OnboardingPage() {
  const [businessName, setBusinessName] = useState("");

  const setup = async () => {
       const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data: business, error } = await supabase
  .from("businesses")
  .insert({
    name: businessName,
    owner_user_id: user.id
  })
  .select()
  .single();

if (error || !business) {
  alert("Business creation failed. Check RLS policies.");
  console.error(error);
  return;
}


    await supabase.from("business_users").insert({
      business_id: business.id,
      user_id: user.id,
      role: "OWNER"
    });

    await supabase.from("financial_years").insert({
      business_id: business.id,
      fy_label: "2024-25"
    });

    window.location.href = "/dashboard";
  };

  return (
    <RequireAuth>
      <div>
        <h1>Business Setup</h1>
        <input
          placeholder="Business Name"
          onChange={e => setBusinessName(e.target.value)}
        />
        <button onClick={setup}>Continue</button>
      </div>
    </RequireAuth>
  );
}
