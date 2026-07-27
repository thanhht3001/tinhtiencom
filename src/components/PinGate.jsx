import { useState } from "react";
import { APPS_SCRIPT_URL } from "../config";
import "./PinGate.css";

export const PIN_STORAGE_KEY = "tinhtiencom_pin";

export default function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "verifyPin", pin }),
      });
      const data = await res.json();
      if (data.result !== "success") throw new Error(data.error || "Mã PIN không đúng");
      localStorage.setItem(PIN_STORAGE_KEY, pin);
      onUnlock(pin);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="pin-gate" onSubmit={handleSubmit}>
      <p className="pin-gate-hint">Nhập mã PIN nhóm để tiếp tục</p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        maxLength={12}
        placeholder="Mã PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting || !pin}>
        {submitting ? "Đang kiểm tra..." : "Xác nhận"}
      </button>
      {error && <p className="pin-gate-error">{error}</p>}
    </form>
  );
}
