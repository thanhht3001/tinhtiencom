import { useEffect, useMemo, useState } from "react";
import { APPS_SCRIPT_URL } from "../config";
import Combobox from "./Combobox";
import "./ExpenseForm.css";

const today = () => new Date().toISOString().slice(0, 10);

const formatVnd = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function ExpenseForm({ onPinRejected }) {
  const [thanhVienList, setThanhVienList] = useState([]);
  const [danhMucNoiDung, setDanhMucNoiDung] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [ngayChi, setNgayChi] = useState(today());
  const [noiDung, setNoiDung] = useState("");
  const [soTien, setSoTien] = useState("");
  const [nguoiChi, setNguoiChi] = useState("");
  const [thamGia, setThamGia] = useState([]);
  const [phuongThuc, setPhuongThuc] = useState("deu");
  const [splitAmounts, setSplitAmounts] = useState({});
  const [pin, setPin] = useState(() => localStorage.getItem("tinhtiencom_pin") || "");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message }

  useEffect(() => {
    fetch(APPS_SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => {
        setThanhVienList(data.thanhVien || []);
        setDanhMucNoiDung(data.danhMucNoiDung || []);
      })
      .catch(() =>
        setLoadError("Không tải được danh sách thành viên. Kiểm tra lại APPS_SCRIPT_URL trong src/config.js.")
      );
  }, []);

  const soTienNumber = Number(soTien) || 0;

  const phanMoiNguoi = useMemo(() => {
    if (phuongThuc !== "deu" || thamGia.length === 0) return 0;
    return Math.round(soTienNumber / thamGia.length);
  }, [phuongThuc, thamGia, soTienNumber]);

  const tongChia = useMemo(() => {
    if (phuongThuc === "deu") return phanMoiNguoi * thamGia.length;
    return thamGia.reduce((sum, name) => sum + (Number(splitAmounts[name]) || 0), 0);
  }, [phuongThuc, thamGia, phanMoiNguoi, splitAmounts]);

  const splitMismatch = thamGia.length > 0 && Math.abs(tongChia - soTienNumber) > 1;

  function toggleThamGia(name) {
    setThamGia((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function handleSplitInput(name, value) {
    setSplitAmounts((prev) => ({ ...prev, [name]: value }));
  }

  function buildChiTiet() {
    if (phuongThuc === "deu") {
      return thamGia.map((name) => ({ nguoi: name, soTien: phanMoiNguoi }));
    }
    return thamGia.map((name) => ({ nguoi: name, soTien: Number(splitAmounts[name]) || 0 }));
  }

  function resetForm() {
    setNgayChi(today());
    setNoiDung("");
    setSoTien("");
    setNguoiChi("");
    setThamGia([]);
    setPhuongThuc("deu");
    setSplitAmounts({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (thamGia.length === 0) {
      setStatus({ type: "error", message: "Vui lòng chọn ít nhất 1 người tham gia." });
      return;
    }
    if (!nguoiChi) {
      setStatus({ type: "error", message: "Vui lòng chọn người chi." });
      return;
    }
    if (splitMismatch) {
      setStatus({ type: "error", message: "Tổng số tiền chia chưa khớp số tiền chi." });
      return;
    }

    const payload = {
      pin,
      ngayChi,
      noiDung: noiDung.trim(),
      soTien: soTienNumber,
      nguoiChi,
      phuongThucChia: phuongThuc === "deu" ? "Chia đều" : "Tự nhập",
      chiTiet: buildChiTiet(),
    };

    setSubmitting(true);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        // text/plain để tránh CORS preflight với Apps Script Web App
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.result !== "success") throw new Error(data.error || "Lỗi không xác định");
      setStatus({ type: "success", message: "Đã lưu thành công!" });
      resetForm();
    } catch (err) {
      setStatus({ type: "error", message: "Gửi thất bại: " + err.message });
      if (err.message.indexOf("PIN") !== -1) onPinRejected?.();
    } finally {
      setSubmitting(false);
    }
  }

  const dataReady = thanhVienList.length > 0;

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="ngayChi">Ngày chi</label>
        <input
          id="ngayChi"
          type="date"
          value={ngayChi}
          onChange={(e) => setNgayChi(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="noiDung">Chi cái gì</label>
        <Combobox
          id="noiDung"
          value={noiDung}
          onChange={setNoiDung}
          options={danhMucNoiDung}
          placeholder="VD: Ăn trưa, đổ xăng..."
          required
        />
      </div>

      <div className="field">
        <label htmlFor="soTien">Số tiền chi</label>
        <input
          id="soTien"
          type="number"
          min="0"
          step="1000"
          placeholder="VD: 100000"
          value={soTien}
          onChange={(e) => setSoTien(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="nguoiChi">Ai là người chi</label>
        <select
          id="nguoiChi"
          value={nguoiChi}
          onChange={(e) => setNguoiChi(e.target.value)}
          required
          disabled={!dataReady}
        >
          <option value="" disabled>
            {dataReady ? "-- Chọn người chi --" : "Đang tải..."}
          </option>
          {thanhVienList.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Ai tham gia trong đợt chi này</label>
        {loadError ? (
          <p className="hint error-text">{loadError}</p>
        ) : (
          <div className="pill-list">
            {thanhVienList.map((name) => {
              const active = thamGia.includes(name);
              return (
                <button
                  type="button"
                  key={name}
                  className={`pill${active ? " pill-active" : ""}`}
                  onClick={() => toggleThamGia(name)}
                  aria-pressed={active}
                >
                  {name}
                </button>
              );
            })}
            {!dataReady && !loadError && <span className="hint">Đang tải danh sách...</span>}
          </div>
        )}
      </div>

      <div className="field">
        <label>Phương thức chia</label>
        <div className="segmented">
          <button
            type="button"
            className={`segment${phuongThuc === "deu" ? " segment-active" : ""}`}
            onClick={() => setPhuongThuc("deu")}
          >
            Chia đều
          </button>
          <button
            type="button"
            className={`segment${phuongThuc === "tuNhap" ? " segment-active" : ""}`}
            onClick={() => setPhuongThuc("tuNhap")}
          >
            Tự nhập số tiền
          </button>
        </div>
      </div>

      {thamGia.length > 0 && (
        <div className="split-box">
          {thamGia.map((name) => (
            <div className="split-row" key={name}>
              <span>{name}</span>
              {phuongThuc === "deu" ? (
                <span className="split-amount">{formatVnd(phanMoiNguoi)}</span>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Số tiền"
                  value={splitAmounts[name] ?? ""}
                  onChange={(e) => handleSplitInput(name, e.target.value)}
                />
              )}
            </div>
          ))}
          <p className={`split-total${splitMismatch ? " mismatch" : ""}`}>
            Đã chia: {formatVnd(tongChia)} / {formatVnd(soTienNumber)}
          </p>
        </div>
      )}

      <button type="submit" className="submit-btn" disabled={submitting || !dataReady}>
        {submitting ? "Đang gửi..." : "Gửi"}
      </button>

      {status && <p className={`status status-${status.type}`}>{status.message}</p>}
    </form>
  );
}
