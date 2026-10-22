"use client";
import { useState } from "react";
import { Notice } from "./AdminShell";

export default function ContactForm() {
  const [state, setState] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setState({ kind: "", text: "" });
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      form.reset();
      return setState({ kind: "ok", text: "Thanks! Your message was sent. I will reply by email." });
    }
    const data = await res?.json().catch(() => null);
    const d = data?.detail;
    const text = res?.status === 429 ? "Too many messages from your network just now. Please try again later."
      : Array.isArray(d) ? d.map((x) => `${(x.loc || []).slice(-1)[0]}: ${x.msg}`).join("; ")
      : typeof d === "string" ? d : "Could not send your message. Please try again or use the email address above.";
    setState({ kind: "error", text });
  }

  return (
    <form onSubmit={submit} className="mt-10 max-w-xl space-y-4" noValidate={false}>
      <h2 className="text-2xl font-semibold">Send a message</h2>
      <Notice kind={state.kind}>{state.text}</Notice>
      <div><label className="label" htmlFor="c-name">Name *</label><input id="c-name" name="name" required maxLength={120} autoComplete="name" className="field" /></div>
      <div><label className="label" htmlFor="c-email">Email *</label><input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="c-subject">Subject</label><input id="c-subject" name="subject" maxLength={200} className="field" /></div>
      <div><label className="label" htmlFor="c-message">Message *</label><textarea id="c-message" name="message" required minLength={10} maxLength={5000} className="field min-h-36" /></div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <label htmlFor="c-website">Leave this field empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-sm text-muted">I store your name, email and message only to reply to you, and delete them when no longer needed.</p>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}
