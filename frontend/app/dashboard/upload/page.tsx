"use client";

import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";
import { useDropzone } from "react-dropzone";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({});

  const onDrop = (acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [] },
  });

  async function uploadFile(file: File) {
    setUploadStatuses(prev => ({ ...prev, [file.name]: "Uploading..." }));

    // 1️⃣ Get logged-in user
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      alert("Not authenticated");
      setUploadStatuses(prev => ({ ...prev, [file.name]: "Failed" }));
      return;
    }

    // 2️⃣ Fetch business_id for user
    const { data: businessUser, error } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .single();

    if (error || !businessUser) {
      console.error(error);
      alert("Business not found");
      setUploadStatuses(prev => ({ ...prev, [file.name]: "Failed" }));
      return;
    }

    const businessId = businessUser.business_id;

    // 3️⃣ Prepare multipart form
    const formData = new FormData();
    formData.append("files", file);

    // 4️⃣ Call backend upload API
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: {
          "x-business-id": businessId,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        console.error(json);
        setUploadStatuses(prev => ({ ...prev, [file.name]: "Failed" }));
        return;
      }

      setUploadStatuses(prev => ({ ...prev, [file.name]: "Uploaded" }));
    } catch (err) {
      console.error(err);
      setUploadStatuses(prev => ({ ...prev, [file.name]: "Failed" }));
    }
  }

  async function uploadAll() {
    for (const file of files) {
      await uploadFile(file);
    }
  }

  return (
    <RequireAuth>
      <div className="container">
        <h1 style={{ textAlign: "center", color: "var(--primary-color)" }}>Upload Invoices</h1>

        <div
          {...getRootProps({
            style: {
              border: "2px dashed var(--primary-color)",
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              borderRadius: "0.25rem",
              backgroundColor: "#f8f9fa",
            },
          })}
        >
          <input {...getInputProps()} />
          <p>Drag and drop files here, or click to select files</p>
        </div>

        <ul style={{ marginTop: "1rem" }}>
          {files.map(file => (
            <li key={file.name} style={{ marginBottom: "0.5rem" }}>
              {file.name} - {uploadStatuses[file.name] || "Pending"}
            </li>
          ))}
        </ul>

        <button
          onClick={uploadAll}
          disabled={files.length === 0}
          style={{ marginTop: "1rem", display: "block", marginLeft: "auto", marginRight: "auto" }}
        >
          Upload All
        </button>
      </div>
    </RequireAuth>
  );
}