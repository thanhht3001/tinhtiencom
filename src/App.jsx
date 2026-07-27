import { useState } from "react";
import ExpenseForm from "./components/ExpenseForm";
import PinGate, { PIN_STORAGE_KEY } from "./components/PinGate";
import "./App.css";

function App() {
  const [unlocked, setUnlocked] = useState(() => !!localStorage.getItem(PIN_STORAGE_KEY));

  function handleLock() {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setUnlocked(false);
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Kê khai chi tiêu</h1>
        {unlocked ? (
          <ExpenseForm onPinRejected={handleLock} />
        ) : (
          <PinGate onUnlock={() => setUnlocked(true)} />
        )}
      </div>
    </main>
  );
}

export default App;
