import { useState } from "react";
import ExpenseForm from "./components/ExpenseForm";
import ChotSo from "./components/ChotSo";
import LichSuChot from "./components/LichSuChot";
import PinGate, { PIN_STORAGE_KEY } from "./components/PinGate";
import "./App.css";

const TABS = [
  { key: "chiTieu", label: "Kê khai chi tiêu" },
  { key: "chotSo", label: "Chốt sổ" },
  { key: "lichSu", label: "Lịch sử chốt" },
];

function App() {
  const [unlocked, setUnlocked] = useState(() => !!localStorage.getItem(PIN_STORAGE_KEY));
  const [tab, setTab] = useState("chiTieu");

  function handleLock() {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setUnlocked(false);
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
            {tab === "chiTieu" && <ExpenseForm onPinRejected={handleLock} />}
            {tab === "chotSo" && <ChotSo onPinRejected={handleLock} />}
            {tab === "lichSu" && <LichSuChot onPinRejected={handleLock} />}
          </>
        ) : (
          <PinGate onUnlock={() => setUnlocked(true)} />
        )}
      </div>
    </main>
  );
}

export default App;
