"use client";

import { useState, useTransition } from "react";

export function ContactForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      type: "contact",
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim()
    };

    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to send message right now.");
      return;
    }

    event.currentTarget.reset();
    startTransition(() => {
      setMessage("Message sent successfully. We will reply through your email.");
    });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        <span>Name</span>
        <input name="name" type="text" placeholder="Your name" required />
      </label>
      <label>
        <span>Email address</span>
        <input name="email" type="email" placeholder="you@example.com" required />
      </label>
      <label>
        <span>Message</span>
        <textarea name="message" rows="5" placeholder="How can we help?" required />
      </label>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
