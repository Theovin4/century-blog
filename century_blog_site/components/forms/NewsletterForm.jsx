"use client";

import { useState, useTransition } from "react";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      type: "newsletter",
      email: String(formData.get("email") || "").trim()
    };

    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to subscribe right now.");
      return;
    }

    event.currentTarget.reset();
    startTransition(() => {
      setMessage("You have been added to the newsletter list.");
    });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        <span>Email address</span>
        <input name="email" type="email" placeholder="you@example.com" required />
      </label>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Join newsletter"}
      </button>
    </form>
  );
}
