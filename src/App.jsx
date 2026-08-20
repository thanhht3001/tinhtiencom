import { useEffect, useState } from "react";
import ExpenseForm from "./components/ExpenseForm";
import ChotSo from "./components/ChotSo";
import LichSuChot from "./components/LichSuChot";
import PinGate, { PIN_STORAGE_KEY } from "./components/PinGate";
import { APPS_SCRIPT_URL } from "./config";
import "./App.css";

const TABS = [
  { key: "chiTieu", label: "Kê khai chi tiêu" },
  { key: "chotSo", label: "Chốt sổ" },
  { key: "lichSu", label: "Lịch sử chốt" },
];

function App() {
  const [unlocked, setUnlocked] = useState(() => !!localStorage.getItem(PIN_STORAGE_KEY));
  const [tab, setTab] = useState("chiTieu");
  // Danh sách thành viên + gợi ý nội dung chi: dùng chung cho cả 3 tab, chỉ fetch 1 lần
  // sau khi unlock thay vì để mỗi tab tự fetch lại khi mount.
  const [sharedData, setSharedData] = useState(null);
  const [sharedDataError, setSharedDataError] = useState("");

  useEffect(() => {
    if (!unlocked) return;
    fetch(APPS_SCRIPT_URL)
      .then((res) => res.json())
      .then((data) =>
        setSharedData({
          thanhVienList: data.thanhVien || [],
          danhMucNoiDung: data.danhMucNoiDung || [],
        })
      )
      .catch(() =>
        setSharedDataError(
          "Không tải được danh sách thành viên. Kiểm tra lại APPS_SCRIPT_URL trong src/config.js."
        )
      );
  }, [unlocked]);

  function handleLock() {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setUnlocked(false);
    setSharedData(null);
    setSharedDataError("");
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Kê khai chi tiêu</h1>
        {unlocked ? (
          <>
            <nav className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`tab${tab === t.key ? " tab-active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {sharedDataError && <p className="hint error-text">{sharedDataError}</p>}
            {!sharedData && !sharedDataError && (
              <div className="loading-state">
                <span className="spinner" aria-hidden="true" />
                <span>Đang tải dữ liệu...</span>
              </div>
            )}
            {sharedData && (
              <>
                {tab === "chiTieu" && (
                  <ExpenseForm
                    thanhVienList={sharedData.thanhVienList}
                    danhMucNoiDung={sharedData.danhMucNoiDung}
                    onPinRejected={handleLock}
                  />
                )}
                {tab === "chotSo" && (
                  <ChotSo thanhVienList={sharedData.thanhVienList} onPinRejected={handleLock} />
                )}
                {tab === "lichSu" && (
                  <LichSuChot thanhVienList={sharedData.thanhVienList} onPinRejected={handleLock} />
                )}
              </>
            )}
          </>
        ) : (
          <PinGate onUnlock={() => setUnlocked(true)} />
        )}
      </div>
    </main>
  );
}

export default App;
