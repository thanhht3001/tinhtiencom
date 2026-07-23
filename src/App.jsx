import ExpenseForm from "./components/ExpenseForm";
import "./App.css";

function App() {
  return (
    <main className="page">
      <div className="card">
        <h1>Kê khai chi tiêu</h1>
        <ExpenseForm />
      </div>
    </main>
  );
}

export default App;
