import { useState } from "react";
import QRPaymentModal from "./QRPaymentModal";
import "./SettlementSummary.css";

const formatVnd = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";

// Hiển thị bảng tổng kết theo người + danh sách giao dịch tối giản.
// Dùng chung giữa tab "Chốt sổ" (xem trước / kết quả vừa chốt) và tab "Lịch sử chốt".
// Tính năng QR/đánh dấu đã thanh toán chỉ bật khi enablePayment=true (chỉ ở Lịch sử chốt,
// vì cần kyId để lưu trạng thái).
export default function SettlementSummary({
  perPerson,
  transactions,
  kyId,
  bankInfo,
  enablePayment,
  thanhVienList,
  onTransactionUpdated,
}) {
  const [qrTarget, setQrTarget] = useState(null); // index của giao dịch đang mở QR

  function handleConfirmed(updatedTransactions) {
    setQrTarget(null);
    onTransactionUpdated?.(updatedTransactions);
  }

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
        <p className="settlement-transactions-warning">
          Do hệ thống phân chia có số lẻ nên sẽ có chênh lệch 1 vài đồng
        </p>
        {transactions.length === 0 ? (
          <p className="hint">Mọi người đã cân bằng, không cần chuyển khoản.</p>
        ) : (
          <ul>
            {transactions.map((t, i) => {
              const daThanhToan = enablePayment && t.daThanhToan;
              const receiverBank = enablePayment ? bankInfo?.[t.den] : null;

              return (
                <li key={i} className={daThanhToan ? "settlement-transaction-paid" : ""}>
                  <div>
                    <strong>{t.tu}</strong> chuyển cho <strong>{t.den}</strong>: {formatVnd(t.soTien)}
                  </div>

                  {daThanhToan && (
                    <p className="settlement-transaction-note settlement-transaction-note-success">
                      Đã xác nhận bởi {t.nguoiDanhDau} lúc{" "}
                      {new Date(t.thoiGianDanhDau).toLocaleString("vi-VN")}
                    </p>
                  )}

                  {!daThanhToan && enablePayment && receiverBank && (
                    <button type="button" className="qr-btn" onClick={() => setQrTarget(i)}>
                      Xem QR
                    </button>
                  )}

                  {!daThanhToan && enablePayment && !receiverBank && (
                    <p className="settlement-transaction-note">
                      {t.den} chưa có thông tin ngân hàng, không tạo được QR.
                    </p>
                  )}

                  {qrTarget === i && receiverBank && (
                    <QRPaymentModal
                      tu={t.tu}
                      den={t.den}
                      soTien={t.soTien}
                      kyId={kyId}
                      index={i}
                      bin={receiverBank.bin}
                      stk={receiverBank.stk}
                      thanhVienList={thanhVienList}
                      onClose={() => setQrTarget(null)}
                      onConfirmed={handleConfirmed}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
