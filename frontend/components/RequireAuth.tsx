"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RequireAuth({
  children
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      if (!data.session) {
        window.location.href = "/auth/login";
      } else {
        setLoading(false);
      }
    });

    // Listen for future auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          window.location.href = "/auth/login";
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  return <>{children}</>;
}