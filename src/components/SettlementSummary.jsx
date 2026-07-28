import "./SettlementSummary.css";

const formatVnd = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";

// Hiển thị bảng tổng kết theo người + danh sách giao dịch tối giản.
// Dùng chung giữa tab "Chốt sổ" (xem trước / kết quả vừa chốt) và tab "Lịch sử chốt".
export default function SettlementSummary({ perPerson, transactions }) {
  return (
    <div className="settlement-summary">
      <table className="settlement-table">
        <thead>
          <tr>
            <th>Người</th>
            <th>Đã trả</th>
            <th>Phải trả</th>
            <th>Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {perPerson.map((p) => (
            <tr key={p.ten}>
              <td>{p.ten}</td>
              <td>{formatVnd(p.daTra)}</td>
              <td>{formatVnd(p.phaiTra)}</td>
              <td className={p.net < 0 ? "amount-negative" : p.net > 0 ? "amount-positive" : ""}>
                {p.net > 0 ? "+" : ""}
                {formatVnd(p.net)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="settlement-transactions">
        <p className="settlement-transactions-title">Gợi ý chuyển khoản</p>
        {transactions.length === 0 ? (
          <p className="hint">Mọi người đã cân bằng, không cần chuyển khoản.</p>
        ) : (
          <ul>
            {transactions.map((t, i) => (
              <li key={i}>
                <strong>{t.tu}</strong> chuyển cho <strong>{t.den}</strong>: {formatVnd(t.soTien)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
