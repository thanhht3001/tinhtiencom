// Dán URL Web App (Apps Script deployment) của bạn vào đây, ví dụ:
// "https://script.google.com/macros/s/AKfycb.../exec"
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const form = document.getElementById("expense-form");
const ngayChiInput = document.getElementById("ngayChi");
const soTienInput = document.getElementById("soTien");
const nguoiChiSelect = document.getElementById("nguoiChi");
const thamGiaList = document.getElementById("thamGiaList");
const chiTietChiaDiv = document.getElementById("chiTietChia");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

let thanhVienList = [];

// Mặc định ngày chi = hôm nay
ngayChiInput.valueAsDate = new Date();

async function loadThanhVien() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    const data = await res.json();
    thanhVienList = data.thanhVien || [];
    renderNguoiChi();
    renderThamGia();
  } catch (err) {
    thamGiaList.textContent = "Không tải được danh sách thành viên. Kiểm tra lại APPS_SCRIPT_URL.";
    nguoiChiSelect.innerHTML = '<option value="" disabled selected>Lỗi tải danh sách</option>';
  }
}

function renderNguoiChi() {
  nguoiChiSelect.innerHTML = '<option value="" disabled selected>-- Chọn người chi --</option>';
  thanhVienList.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    nguoiChiSelect.appendChild(opt);
  });
}

function renderThamGia() {
  thamGiaList.innerHTML = "";
  thanhVienList.forEach((name) => {
    const wrapper = document.createElement("label");
    wrapper.className = "checkbox-item";
    wrapper.innerHTML = `<input type="checkbox" name="thamGia" value="${name}" /> ${name}`;
    thamGiaList.appendChild(wrapper);
  });
  thamGiaList.addEventListener("change", renderChiTietChia);
}

function getSelectedThamGia() {
  return Array.from(thamGiaList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (el) => el.value
  );
}

function getPhuongThucChia() {
  return form.querySelector('input[name="phuongThucChia"]:checked').value;
}

function renderChiTietChia() {
  const selected = getSelectedThamGia();
  const phuongThuc = getPhuongThucChia();
  const soTien = Number(soTienInput.value) || 0;

  chiTietChiaDiv.innerHTML = "";

  if (selected.length === 0) {
    chiTietChiaDiv.innerHTML = '<p class="split-total">Chọn ít nhất 1 người tham gia.</p>';
    return;
  }

  if (phuongThuc === "deu") {
    const phanMoiNguoi = selected.length ? Math.round(soTien / selected.length) : 0;
    selected.forEach((name) => {
      const row = document.createElement("div");
      row.className = "split-row";
      row.innerHTML = `<span>${name}</span><span>${phanMoiNguoi.toLocaleString("vi-VN")} đ</span>`;
      chiTietChiaDiv.appendChild(row);
    });
    appendTotalLine(phanMoiNguoi * selected.length, soTien);
  } else {
    selected.forEach((name) => {
      const row = document.createElement("div");
      row.className = "split-row";
      row.innerHTML = `<span>${name}</span><input type="number" class="split-input" data-name="${name}" min="0" step="1000" placeholder="Số tiền" />`;
      chiTietChiaDiv.appendChild(row);
    });
    const totalLine = document.createElement("p");
    totalLine.className = "split-total";
    totalLine.id = "splitTotalLine";
    chiTietChiaDiv.appendChild(totalLine);
    chiTietChiaDiv.querySelectorAll(".split-input").forEach((input) => {
      input.addEventListener("input", updateManualTotal);
    });
    updateManualTotal();
  }
}

function updateManualTotal() {
  const soTien = Number(soTienInput.value) || 0;
  const inputs = chiTietChiaDiv.querySelectorAll(".split-input");
  const tong = Array.from(inputs).reduce((sum, el) => sum + (Number(el.value) || 0), 0);
  const line = document.getElementById("splitTotalLine");
  if (!line) return;
  line.textContent = `Đã chia: ${tong.toLocaleString("vi-VN")} đ / ${soTien.toLocaleString("vi-VN")} đ`;
  line.classList.toggle("mismatch", tong !== soTien);
}

function appendTotalLine(tong, soTien) {
  const line = document.createElement("p");
  line.className = "split-total";
  line.textContent = `Tổng chia: ${tong.toLocaleString("vi-VN")} đ / ${soTien.toLocaleString("vi-VN")} đ`;
  chiTietChiaDiv.appendChild(line);
}

function buildChiTiet() {
  const phuongThuc = getPhuongThucChia();
  const selected = getSelectedThamGia();
  const soTien = Number(soTienInput.value) || 0;

  if (phuongThuc === "deu") {
    const phanMoiNguoi = Math.round(soTien / selected.length);
    return selected.map((name) => ({ nguoi: name, soTien: phanMoiNguoi }));
  }

  return Array.from(chiTietChiaDiv.querySelectorAll(".split-input")).map((el) => ({
    nguoi: el.dataset.name,
    soTien: Number(el.value) || 0,
  }));
}

soTienInput.addEventListener("input", renderChiTietChia);
form.querySelectorAll('input[name="phuongThucChia"]').forEach((el) => {
  el.addEventListener("change", renderChiTietChia);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusMsg.textContent = "";
  statusMsg.className = "status";

  const selected = getSelectedThamGia();
  if (selected.length === 0) {
    statusMsg.textContent = "Vui lòng chọn ít nhất 1 người tham gia.";
    statusMsg.className = "status error";
    return;
  }

  const chiTiet = buildChiTiet();
  const soTien = Number(soTienInput.value) || 0;
  const tongChia = chiTiet.reduce((sum, item) => sum + item.soTien, 0);

  if (Math.abs(tongChia - soTien) > 1) {
    statusMsg.textContent = "Tổng số tiền chia chưa khớp số tiền chi.";
    statusMsg.className = "status error";
    return;
  }

  const payload = {
    ngayChi: ngayChiInput.value,
    noiDung: document.getElementById("noiDung").value.trim(),
    soTien,
    nguoiChi: nguoiChiSelect.value,
    phuongThucChia: getPhuongThucChia() === "deu" ? "Chia đều" : "Tự nhập",
    chiTiet,
  };

  submitBtn.disabled = true;
  statusMsg.textContent = "Đang gửi...";

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // dùng text/plain để tránh CORS preflight với Apps Script Web App
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.result === "success") {
      statusMsg.textContent = "Đã lưu thành công!";
      statusMsg.className = "status success";
      form.reset();
      ngayChiInput.valueAsDate = new Date();
      renderThamGia();
      chiTietChiaDiv.innerHTML = "";
    } else {
      throw new Error(data.error || "Lỗi không xác định");
    }
  } catch (err) {
    statusMsg.textContent = "Gửi thất bại: " + err.message;
    statusMsg.className = "status error";
  } finally {
    submitBtn.disabled = false;
  }
});

loadThanhVien();
