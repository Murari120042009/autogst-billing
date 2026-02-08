"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/auth/login";
      }
    });
  }, []);

  return <p>Redirecting...</p>;
}
