/**
 * Backend Apps Script cho web kê khai chi tiêu.
 * Gắn (bound) script này vào Google Sheet có các sheet:
 *   - DanhMucThanhVien : cột A = Tên thành viên (dòng 1 là header)
 *   - DanhMucNoiDung   : cột A = Nội dung chi thường gặp (dòng 1 là header) — không bắt buộc phải có
 *   - ChiTieu          : ID | Ngày chi | Nội dung | Số tiền chi | Người chi | Phương thức chia | Thời gian nhập
 *   - ChiTietChia      : ID | Ngày chi | Người tham gia | Số tiền phải trả
 */

var SHEET_THANH_VIEN = 'DanhMucThanhVien';
var SHEET_DANH_MUC_NOI_DUNG = 'DanhMucNoiDung';
var SHEET_CHI_TIEU = 'ChiTieu';
var SHEET_CHI_TIET_CHIA = 'ChiTietChia';

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
    validate(data);

    var ss = SpreadsheetApp.getActive();
    var shChiTieu = ss.getSheetByName(SHEET_CHI_TIEU);
    var shChiTietChia = ss.getSheetByName(SHEET_CHI_TIET_CHIA);

    var id = Utilities.getUuid();
    var now = new Date();

    shChiTieu.appendRow([
      id,
      data.ngayChi,
      data.noiDung,
      data.soTien,
      data.nguoiChi,
      data.phuongThucChia,
      now
    ]);

    var rows = data.chiTiet.map(function (item) {
      return [id, data.ngayChi, item.nguoi, item.soTien];
    });
    if (rows.length > 0) {
      shChiTietChia
        .getRange(shChiTietChia.getLastRow() + 1, 1, rows.length, 4)
        .setValues(rows);
    }

    return jsonOutput({ result: 'success', id: id });
  } catch (err) {
    return jsonOutput({ result: 'error', error: err.message || String(err) });
  }
}

function validate(data) {
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
