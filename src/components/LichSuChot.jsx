import { useEffect, useState } from "react";
import { APPS_SCRIPT_URL } from "../config";
import { PIN_STORAGE_KEY } from "./PinGate";
import SettlementSummary from "./SettlementSummary";
import "./LichSuChot.css";

const formatVnd = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function LichSuChot({ onPinRejected }) {
  const [kyList, setKyList] = useState(null);
  const [bankInfo, setBankInfo] = useState({});
  const [thanhVienList, setThanhVienList] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [expandedKyId, setExpandedKyId] = useState(null);

  useEffect(() => {
    const pin = localStorage.getItem(PIN_STORAGE_KEY) || "";

    fetch(APPS_SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => setThanhVienList(data.thanhVien || []))
      .catch(() => {});

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "lichSuChot", pin }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result !== "success") throw new Error(data.error || "Lỗi không xác định");
        setKyList(data.kyList || []);
        setBankInfo(data.bankInfo || {});
      })
      .catch((err) => {
        setLoadError("Không tải được lịch sử: " + err.message);
        if (err.message.indexOf("PIN") !== -1) onPinRejected?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTransactionUpdated(kyId, updatedTransactions) {
    setKyList((list) =>
      list.map((ky) => (ky.kyId === kyId ? { ...ky, transactions: updatedTransactions } : ky))
    );
  }

  if (loadError) return <p className="hint error-text">{loadError}</p>;
  if (!kyList) return <p className="hint">Đang tải lịch sử...</p>;
  if (kyList.length === 0) return <p className="hint">Chưa có kỳ chốt sổ nào.</p>;

  return (
    <div className="lich-su-chot">
      {kyList.map((ky) => {
        const expanded = expandedKyId === ky.kyId;
        return (
          <div className="ky-card" key={ky.kyId}>
            <button
              type="button"
              className="ky-card-header"
              onClick={() => setExpandedKyId(expanded ? null : ky.kyId)}
              aria-expanded={expanded}
            >
              <div>
                <p className="ky-card-title">
                  {ky.kyId} — {ky.nguoiChot}
                </p>
                <p className="ky-card-sub">
                  {new Date(ky.ngayChot).toLocaleString("vi-VN")} · {ky.soDongChiTieu} khoản chi
                </p>
              </div>
              <span className="ky-card-total">{formatVnd(ky.tongSoTien)}</span>
            </button>

            {expanded && (
              <div className="ky-card-body">
                <p className="chot-so-range">
                  Từ {ky.tuNgay} đến {ky.denNgay}
                </p>
                <SettlementSummary
                  perPerson={ky.perPerson}
                  transactions={ky.transactions}
                  kyId={ky.kyId}
                  bankInfo={bankInfo}
                  enablePayment
                  thanhVienList={thanhVienList}
                  onTransactionUpdated={(updated) => handleTransactionUpdated(ky.kyId, updated)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
