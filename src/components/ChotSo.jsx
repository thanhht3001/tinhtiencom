import { useEffect, useState } from "react";
import { APPS_SCRIPT_URL } from "../config";
import { PIN_STORAGE_KEY } from "./PinGate";
import SettlementSummary from "./SettlementSummary";
import "./ChotSo.css";

async function postAction(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    // text/plain để tránh CORS preflight với Apps Script Web App
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.result !== "success") throw new Error(data.error || "Lỗi không xác định");
  return data;
}

export default function ChotSo({ thanhVienList, onPinRejected }) {
  const pin = localStorage.getItem(PIN_STORAGE_KEY) || "";

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [nguoiChot, setNguoiChot] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPin, setConfirmPin] = useState(pin);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message }
  const [result, setResult] = useState(null); // kết quả sau khi chốt thành công

  useEffect(() => {
    postAction({ action: "chotSoPreview", pin })
      .then(setPreview)
      .catch((err) => {
        setLoadError("Không tải được số liệu: " + err.message);
        if (err.message.indexOf("PIN") !== -1) onPinRejected?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmSubmit(e) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    try {
      const data = await postAction({
        action: "chotSo",
        pin: confirmPin,
        nguoiChot,
        userAgent: navigator.userAgent,
      });
      setResult(data);
      setShowConfirm(false);
      setStatus({ type: "success", message: `Đã chốt sổ xong (kỳ ${data.kyId}).` });
    } catch (err) {
      setStatus({ type: "error", message: "Chốt sổ thất bại: " + err.message });
      if (err.message.indexOf("PIN") !== -1) onPinRejected?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <p className="hint error-text">{loadError}</p>;
  }

  if (result) {
    return (
      <div className="chot-so">
        {status && <p className={`status status-${status.type}`}>{status.message}</p>}
        <SettlementSummary perPerson={result.perPerson} transactions={result.transactions} />
      </div>
    );
  }

  if (!preview) {
    return <p className="hint">Đang tải số liệu...</p>;
  }

  if (preview.soDongChiTieu === 0) {
    return <p className="hint">Không có khoản chi nào để chốt sổ.</p>;
  }

  return (
    <div className="chot-so">
      <p className="chot-so-range">
        Từ {preview.tuNgay} đến {preview.denNgay} — {preview.soDongChiTieu} khoản chi
      </p>

      <SettlementSummary perPerson={preview.perPerson} transactions={preview.transactions} />

      <div className="field">
        <label htmlFor="nguoiChot">Người thực hiện chốt sổ</label>
        <select
          id="nguoiChot"
          value={nguoiChot}
          onChange={(e) => setNguoiChot(e.target.value)}
          disabled={thanhVienList.length === 0}
        >
          <option value="" disabled>
            -- Chọn tên --
          </option>
          {thanhVienList.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {!showConfirm ? (
        <button
          type="button"
          className="submit-btn"
          disabled={!nguoiChot}
          onClick={() => setShowConfirm(true)}
        >
          Chốt sổ
        </button>
      ) : (
        <form className="pin-gate chot-so-confirm" onSubmit={handleConfirmSubmit}>
          <p className="pin-gate-hint">Nhập lại mã PIN nhóm để xác nhận chốt sổ</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={12}
            placeholder="Mã PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            required
          />
          <div className="chot-so-confirm-actions">
            <button type="button" className="cancel-btn" onClick={() => setShowConfirm(false)}>
              Huỷ
            </button>
            <button type="submit" disabled={submitting || !confirmPin}>
              {submitting ? "Đang chốt sổ..." : "Xác nhận chốt sổ"}
            </button>
          </div>
        </form>
      )}

      {status && <p className={`status status-${status.type}`}>{status.message}</p>}
    </div>
  );
}
