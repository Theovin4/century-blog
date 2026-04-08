"use client";

import { useState, useTransition } from "react";

const substackUrl = process.env.NEXT_PUBLIC_SUBSTACK_URL || "";

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
      setMessage(
        data.destination === "substack"
          ? "Subscription captured and forwarded to Substack."
          : "You have been added to the newsletter list."
      );
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
      <div className="stack-form__actions">
        <button type="submit" className="button button-primary" disabled={isPending}>
          {isPending ? "Saving..." : "Join newsletter"}
        </button>
        {substackUrl ? (
          <a href={substackUrl} target="_blank" rel="noreferrer" className="button button-secondary">
            Subscribe on Substack
          </a>
        ) : null}
      </div>
    </form>
  );
}
