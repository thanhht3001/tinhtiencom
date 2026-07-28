/**
 * Backend Apps Script cho web kê khai chi tiêu.
 * Gắn (bound) script này vào Google Sheet có các sheet:
 *   - DanhMucThanhVien : cột A = Tên thành viên (dòng 1 là header)
 *   - DanhMucNoiDung   : cột A = Nội dung chi thường gặp (dòng 1 là header) — không bắt buộc phải có
 *   - ChiTieu          : ID | Ngày chi | Nội dung | Số tiền chi | Người chi | Phương thức chia | Thời gian nhập | ID Kỳ | Thiết bị
 *   - ChiTietChia      : ID | Ngày chi | Người chi | Người tham gia | Số tiền phải trả | ID Kỳ
 *   - CauHinh          : cột A = Tên cấu hình | cột B = Giá trị (VD: dòng "Pin" | "0108")
 *   - LichSuChot       : ID Kỳ | Thời gian chốt | Người chốt | Thiết bị | Từ ngày | Đến ngày | Số dòng chi tiêu | Tổng số tiền | Tổng kết theo người (JSON) | Giao dịch tối giản (JSON)
 *
 * Sau khi dán bản cập nhật này vào Apps Script editor, chạy tay hàm migrateChotSoSchema()
 * một lần (chọn hàm trong dropdown editor rồi bấm Run) để thêm cột/sheet mới,
 * TRƯỚC KHI deploy lại Web App (Deploy > Manage deployments > New version).
 */

var SHEET_THANH_VIEN = 'DanhMucThanhVien';
var SHEET_DANH_MUC_NOI_DUNG = 'DanhMucNoiDung';
var SHEET_CHI_TIEU = 'ChiTieu';
var SHEET_CHI_TIET_CHIA = 'ChiTietChia';
var SHEET_CAU_HINH = 'CauHinh';
var SHEET_LICH_SU_CHOT = 'LichSuChot';
var DEFAULT_PIN = '0108'; // Dùng khi sheet CauHinh chưa có dòng "Pin"
var SETTLEMENT_EPSILON = 1; // Ngưỡng sai số làm tròn khi cấn trừ công nợ (đồng bộ với validate())

function getConfigValue(key) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_CAU_HINH);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) return String(values[i][1]).trim();
  }
  return null;
}

function getRequiredPin() {
  return getConfigValue('Pin') || DEFAULT_PIN;
}

// Chống formula injection: nếu chuỗi bắt đầu bằng =, +, -, @ (hoặc tab),
// Sheets có thể hiểu nhầm thành công thức. Thêm dấu ' phía trước để ép kiểu văn bản.
function sanitizeText(value) {
  var text = String(value == null ? '' : value);
  if (/^[=+\-@\t]/.test(text)) return "'" + text;
  return text;
}

function doGet(e) {
  return jsonOutput({
    thanhVien: readColumnA(SHEET_THANH_VIEN),
    danhMucNoiDung: readColumnA(SHEET_DANH_MUC_NOI_DUNG)
  });
}

function readColumnA(sheetName) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var value = values[i][0];
    if (value) result.push(String(value).trim());
  }
  return result;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'verifyPin') {
      if (data.pin !== getRequiredPin()) throw new Error('Mã PIN không chính xác');
      return jsonOutput({ result: 'success' });
    }

    if (data.action === 'chotSoPreview') {
      if (data.pin !== getRequiredPin()) throw new Error('Mã PIN nhóm không chính xác');
      var preview = computeOpenSettlement();
      return jsonOutput({
        result: 'success',
        perPerson: preview.perPerson,
        transactions: preview.transactions,
        soDongChiTieu: preview.soDongChiTieu,
        tongSoTien: preview.tongSoTien,
        tuNgay: preview.tuNgay,
        denNgay: preview.denNgay
      });
    }

    if (data.action === 'chotSo') {
      return jsonOutput(thucHienChotSo(data));
    }

    if (data.action === 'lichSuChot') {
      if (data.pin !== getRequiredPin()) throw new Error('Mã PIN nhóm không chính xác');
      return jsonOutput({ result: 'success', kyList: docLichSuChot() });
    }

    validate(data);

    var ss = SpreadsheetApp.getActive();
    var shChiTieu = ss.getSheetByName(SHEET_CHI_TIEU);
    var shChiTietChia = ss.getSheetByName(SHEET_CHI_TIET_CHIA);

    var id = Utilities.getUuid();
    var now = new Date();

    // Ghi vào sheet ChiTieu
    shChiTieu.appendRow([
      id,
      data.ngayChi,
      sanitizeText(data.noiDung),
      data.soTien,
      sanitizeText(data.nguoiChi),
      data.phuongThucChia,
      now,
      '', // ID Kỳ - rỗng nghĩa là chưa chốt
      sanitizeText(data.userAgent || '')
    ]);

    // Tạo mảng dữ liệu cho sheet ChiTietChia (cột cuối "ID Kỳ" để rỗng - chưa chốt)
    var rows = data.chiTiet.map(function (item) {
      return [id, data.ngayChi, sanitizeText(data.nguoiChi), sanitizeText(item.nguoi), item.soTien, ''];
    });

    if (rows.length > 0) {
      shChiTietChia
        .getRange(shChiTietChia.getLastRow() + 1, 1, rows.length, rows[0].length) // Tự động nhận diện số cột thay vì cố định
        .setValues(rows);
    }

    return jsonOutput({ result: 'success', id: id });
  } catch (err) {
    return jsonOutput({ result: 'error', error: err.message || String(err) });
  }
}

function validate(data) {
  if (data.pin !== getRequiredPin()) throw new Error('Mã PIN nhóm không chính xác');
  if (!data.ngayChi) throw new Error('Thiếu ngày chi');
  if (!data.noiDung) throw new Error('Thiếu nội dung chi');
  if (!data.soTien || isNaN(data.soTien) || Number(data.soTien) <= 0) {
    throw new Error('Số tiền chi không hợp lệ');
  }
  if (!data.nguoiChi) throw new Error('Thiếu người chi');
  if (!data.chiTiet || !data.chiTiet.length) throw new Error('Thiếu danh sách người tham gia');

  var tong = data.chiTiet.reduce(function (sum, item) {
    return sum + Number(item.soTien || 0);
  }, 0);
  if (Math.abs(tong - Number(data.soTien)) > 1) {
    throw new Error('Tổng số tiền chia (' + tong + ') không khớp số tiền chi (' + data.soTien + ')');
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Chốt sổ =====

// Đọc toàn bộ dòng chưa chốt (cột "ID Kỳ" rỗng) từ ChiTieu + ChiTietChia,
// tính tổng đã trả / phải trả từng người, và gợi ý giao dịch tối giản.
// Luôn đọc trực tiếp từ sheet chứ không tin số liệu do client gửi lên,
// để action 'chotSo' có thể gọi lại hàm này ngay trong lock và ra kết quả đáng tin.
function computeOpenSettlement() {
  var ss = SpreadsheetApp.getActive();
  var shChiTieu = ss.getSheetByName(SHEET_CHI_TIEU);
  var shChiTietChia = ss.getSheetByName(SHEET_CHI_TIET_CHIA);

  var chiTieuValues = shChiTieu.getDataRange().getValues();
  var chiTietValues = shChiTietChia.getDataRange().getValues();

  var daTra = {};
  var openChiTieuIds = {};
  var chiTieuRowsOpen = []; // số dòng thực tế trên sheet (1-based) của các dòng chưa chốt
  var tongSoTien = 0;
  var tuNgay = null;
  var denNgay = null;

  for (var i = 1; i < chiTieuValues.length; i++) {
    var row = chiTieuValues[i];
    var idKy = row[7]; // cột H
    if (idKy) continue; // đã chốt trước đó, bỏ qua
    var id = row[0];
    var ngayChi = row[1];
    var soTien = Number(row[3]) || 0;
    var nguoiChi = row[4];

    openChiTieuIds[id] = true;
    chiTieuRowsOpen.push(i + 1); // getValues 0-based -> số dòng thật trên sheet là i+1
    daTra[nguoiChi] = (daTra[nguoiChi] || 0) + soTien;
    tongSoTien += soTien;

    var ngayChiDate = ngayChi instanceof Date ? ngayChi : new Date(ngayChi);
    if (!isNaN(ngayChiDate.getTime())) {
      if (!tuNgay || ngayChiDate < tuNgay) tuNgay = ngayChiDate;
      if (!denNgay || ngayChiDate > denNgay) denNgay = ngayChiDate;
    }
  }

  var phaiTra = {};
  var chiTietChiaRowsOpen = [];

  for (var j = 1; j < chiTietValues.length; j++) {
    var r = chiTietValues[j];
    var idChiTiet = r[0];
    if (!openChiTieuIds[idChiTiet]) continue; // chỉ tính dòng thuộc hóa đơn chưa chốt
    var nguoiThamGia = r[3];
    var soTienPhai = Number(r[4]) || 0;
    phaiTra[nguoiThamGia] = (phaiTra[nguoiThamGia] || 0) + soTienPhai;
    chiTietChiaRowsOpen.push(j + 1);
  }

  var tenAll = {};
  readColumnA(SHEET_THANH_VIEN).forEach(function (ten) { tenAll[ten] = true; });
  Object.keys(daTra).forEach(function (ten) { tenAll[ten] = true; });
  Object.keys(phaiTra).forEach(function (ten) { tenAll[ten] = true; });

  var perPerson = Object.keys(tenAll).map(function (ten) {
    var da = Math.round((daTra[ten] || 0) * 100) / 100;
    var phai = Math.round((phaiTra[ten] || 0) * 100) / 100;
    return { ten: ten, daTra: da, phaiTra: phai, net: Math.round((da - phai) * 100) / 100 };
  });

  return {
    perPerson: perPerson,
    transactions: donGianHoaNo(perPerson),
    soDongChiTieu: chiTieuRowsOpen.length,
    tongSoTien: tongSoTien,
    tuNgay: tuNgay ? Utilities.formatDate(tuNgay, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : null,
    denNgay: denNgay ? Utilities.formatDate(denNgay, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : null,
    chiTieuRowsOpen: chiTieuRowsOpen,
    chiTietChiaRowsOpen: chiTietChiaRowsOpen
  };
}

// Thuật toán tham lam tối giản hoá công nợ: ghép người nợ nhiều nhất với người
// được nợ nhiều nhất, cấn trừ tối đa có thể, lặp lại tới khi hết.
// Tối đa (n-1) giao dịch cho n người. Chênh lệch trong khoảng SETTLEMENT_EPSILON
// bị bỏ qua (coi như đã cân bằng) để không tạo giao dịch vài đồng vô nghĩa.
function donGianHoaNo(perPerson) {
  var debtors = [];
  var creditors = [];
  perPerson.forEach(function (p) {
    if (p.net < -SETTLEMENT_EPSILON) debtors.push({ ten: p.ten, soTien: -p.net });
    else if (p.net > SETTLEMENT_EPSILON) creditors.push({ ten: p.ten, soTien: p.net });
  });
  debtors.sort(function (a, b) { return b.soTien - a.soTien; });
  creditors.sort(function (a, b) { return b.soTien - a.soTien; });

  var giaoDich = [];
  var i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    var amt = Math.round(Math.min(debtors[i].soTien, creditors[j].soTien));
    if (amt > 0) giaoDich.push({ tu: debtors[i].ten, den: creditors[j].ten, soTien: amt });
    debtors[i].soTien -= amt;
    creditors[j].soTien -= amt;
    if (debtors[i].soTien <= SETTLEMENT_EPSILON) i++;
    if (creditors[j].soTien <= SETTLEMENT_EPSILON) j++;
  }
  return giaoDich;
}

// action 'chotSo': xác thực PIN + người chốt, tính lại số liệu NGAY TRONG LOCK
// (không tái dùng số liệu preview trước đó) rồi đánh dấu các dòng đang mở thành đã chốt.
// LockService đảm bảo 2 request "chốt" đồng thời không xử lý trùng cùng một lô dữ liệu.
function thucHienChotSo(data) {
  if (data.pin !== getRequiredPin()) throw new Error('Mã PIN nhóm không chính xác');
  var nguoiChot = sanitizeText(String(data.nguoiChot || '').trim());
  if (!nguoiChot) throw new Error('Thiếu người thực hiện chốt sổ');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ket = computeOpenSettlement();
    if (ket.soDongChiTieu === 0) throw new Error('Không có khoản chi nào để chốt sổ.');

    var ss = SpreadsheetApp.getActive();
    var tz = ss.getSpreadsheetTimeZone();
    var idKy = 'K' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');

    danhDauDaChot(ss.getSheetByName(SHEET_CHI_TIEU), 8, ket.chiTieuRowsOpen, idKy);
    danhDauDaChot(ss.getSheetByName(SHEET_CHI_TIET_CHIA), 6, ket.chiTietChiaRowsOpen, idKy);

    var shLichSu = ss.getSheetByName(SHEET_LICH_SU_CHOT);
    shLichSu.appendRow([
      idKy,
      new Date(),
      nguoiChot,
      sanitizeText(data.userAgent || ''),
      ket.tuNgay,
      ket.denNgay,
      ket.soDongChiTieu,
      ket.tongSoTien,
      JSON.stringify(ket.perPerson),
      JSON.stringify(ket.transactions)
    ]);

    return {
      result: 'success',
      kyId: idKy,
      perPerson: ket.perPerson,
      transactions: ket.transactions,
      soDongChiTieu: ket.soDongChiTieu,
      tongSoTien: ket.tongSoTien
    };
  } finally {
    lock.releaseLock();
  }
}

// Đọc nguyên cột "ID Kỳ" (colIndex, 1-based) của sheet, gán idKy vào đúng các dòng
// trong rowNumbers rồi ghi lại toàn cột 1 lần — tránh vòng lặp setValue từng dòng.
function danhDauDaChot(sheet, colIndex, rowNumbers, idKy) {
  if (!rowNumbers.length) return;
  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, colIndex, lastRow - 1, 1);
  var values = range.getValues();
  rowNumbers.forEach(function (rowNumber) {
    values[rowNumber - 2][0] = idKy; // dòng 2 trên sheet ứng với index 0 của mảng
  });
  range.setValues(values);
}

function docLichSuChot() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_LICH_SU_CHOT);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    result.push({
      kyId: row[0],
      ngayChot: row[1],
      nguoiChot: row[2],
      thietBi: row[3],
      tuNgay: row[4],
      denNgay: row[5],
      soDongChiTieu: row[6],
      tongSoTien: row[7],
      perPerson: safeJsonParse(row[8]),
      transactions: safeJsonParse(row[9])
    });
  }
  return result.reverse();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return [];
  }
}

// ===== Migration (chạy tay 1 lần) =====

// Idempotent - an toàn khi chạy lại nhiều lần, chỉ thêm header/sheet còn thiếu,
// không bao giờ ghi đè dữ liệu dòng đã có. Chạy từ Apps Script editor: chọn hàm
// migrateChotSoSchema trong dropdown rồi bấm Run, TRƯỚC KHI deploy lại Web App.
function migrateChotSoSchema() {
  var ss = SpreadsheetApp.getActive();

  var shChiTieu = ss.getSheetByName(SHEET_CHI_TIEU);
  ensureHeader(shChiTieu, 8, 'ID Kỳ');
  ensureHeader(shChiTieu, 9, 'Thiết bị');

  var shChiTietChia = ss.getSheetByName(SHEET_CHI_TIET_CHIA);
  ensureHeader(shChiTietChia, 6, 'ID Kỳ');

  var shLichSu = ss.getSheetByName(SHEET_LICH_SU_CHOT);
  if (!shLichSu) {
    shLichSu = ss.insertSheet(SHEET_LICH_SU_CHOT);
    shLichSu.appendRow([
      'ID Kỳ', 'Thời gian chốt', 'Người chốt', 'Thiết bị',
      'Từ ngày', 'Đến ngày', 'Số dòng chi tiêu', 'Tổng số tiền',
      'Tổng kết theo người (JSON)', 'Giao dịch tối giản (JSON)'
    ]);
    shLichSu.setFrozenRows(1);
  }

  Logger.log('migrateChotSoSchema: hoàn tất.');
}

function ensureHeader(sheet, colIndex, label) {
  var current = sheet.getRange(1, colIndex).getValue();
  if (current !== label) sheet.getRange(1, colIndex).setValue(label);
}
