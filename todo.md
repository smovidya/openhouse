# Pages

## 20 Oct

- landing
- ลงทะเบียน
  - หน้า login
  - form
  - pdpa
- เลือก workshop
  - list workshop
  - รายละเอียด workshop + เลือกสล็อตเวลา
- myid

## 26 Oct

- make a guide

## 28 Oct

- myid (เสร็จ)
  - prize
- staff
- qrcode page

## 30 Oct

- certification
- เปิดงาน

# Staff scanner pages

## ต้องไปหาข้อมูล / ตัดสินใจ

- ข้อมูลจริงของ เช็คแลกของที่ระลึก (Figma "เมนู เช็คแลกของที่ระลึก") — ทำทีหลังสุด
  - เกณฑ์แต่ละขั้น (ลูกเรือ / รองหัวหน้า / กัปตัน) × นิทรรศการ / เวิร์คช็อป / กิจกรรม / เวที (Figma ยังเป็น 1/2/3)
  - แลกขั้นไหน: ขั้นสูงสุดที่ผ่าน? (แลกได้ครั้งเดียวต่อคน แลกแล้วล็อก เก็บกิจกรรมเพิ่มไม่ได้)
  - ไม่ผ่านขั้นไหนเลย / แลกไปแล้ว: แสดง error?
  - branch `ptsgrn/activities-completments` (ยัง dev อยู่) มี `tierRequirements` ใน checkpoints/progress.ts แล้ว:
    นับเป็นจำนวนภาควิชา / เวิร์คช็อป / เวที + ต้องมี TCAS และกิจกรรมส่วนกลาง — ไม่ตรงกับหมวดในตาราง Figma
    (นิทรรศการ / เวิร์คช็อป / กิจกรรม / เวที) ต้องเช็คว่าอันไหนถูก
- frame ที่ไม่มีกล้อง (2272:1227) แปลกๆ — ตอนนี้ถือว่าเป็นโหมดกรอกรหัส (มีแท็บ + ช่องกรอกเหมือนหน้าอื่น) ถาม designer อีกที

## ตัดสินใจแล้ว

- รหัส QR: 5 ตัวจาก `2345679ACDEFGHJKLMNPQRSTUVWXYZ%#@` (ไม่มีตัวเล็ก, ดู selfRegisterAttendee)
  - backend ไม่ได้เช็ค format (getAttendeeProfileByQrCodeId รับ `z.string()` แล้วหาแบบตรงตัว)
  - frontend (src/lib/qr-code.ts): แปลงเป็นตัวใหญ่ + เช็ค format ก่อนค้นหา; ตอน dev รับทุกรหัส เพราะ `dev-attendee-qr` ไม่ตรง format
  - ถ้า backend มี schema ของรหัสทีหลัง ให้ใช้อันนั้นแทน
- เวิร์คช็อป: picker แสดงทุกเวิร์คช็อป (staff เลือกเอง; permission จำกัดแค่บูธภาควิชา)
- เวิร์คช็อป: โหมดเพิ่มคน + คนที่ลงทะเบียนล่วงหน้ารอบนี้ = เช็คอินให้เลย (ไม่ error)
- เวิร์คช็อป: "ลบออก" (walk-in) ต้องยืนยันก่อน
- ของที่ระลึก: ใน sheet "รับของรางวัล" แสดงบูธที่ยังไม่ได้เก็บด้วย (mock) — ตามคู่มือสตาฟ
- ของที่ระลึก: ประวัติการแลกเป็นระดับงาน (ทั้งหมด) ไม่ใช่รายบูธ, ใหม่สุดก่อน
- ของที่ระลึก: หน้าสแกนเพิ่มปุ่มย้อนกลับ

## ยังไม่มี backend (หน้าใช้ mock data ไปก่อน, ดู src/lib/mock/)

- อีเมลของผู้เข้าร่วม: ไม่มี lookup ไหนคืนอีเมล (อยู่ใน users) แม้แต่ใน ptsgrn branch — `mockAttendeeEmail`
- เวิร์คช็อป: เช็คอิน / เพิ่มคน / switch / ลบออก / รายชื่อ / ยอด — `mock/workshop-attendance.svelte.ts`
  - mock ตาม attendance API ใน `ptsgrn/activities-completments` (checkInWorkshop, setWorkshopAttendance,
    listWorkshopAttendance, getWorkshopAttendanceStats + error code 409) พอ merge แล้วเปลี่ยน import
  - ต่างจากของจริง: id รอบเป็น `<slug>:<round>` ไม่ใช่ id ใน D1; checkInWorkshop รับ attendee เพิ่ม
  - mock: dev fixture ลงทะเบียนทุกรอบ, คนอื่นเป็น walk-in; state หายเมื่อ reload
  - ENTRY_REQUIRED (ยังไม่ผ่านจุดลงทะเบียน) มีข้อความแล้ว แต่ mock ไม่เคยส่ง
- ของที่ระลึก: ยอดสะสม, บูธที่ยังไม่ได้เก็บ, แลกของ, ประวัติการแลก (ptsgrn branch มี previewReward / redeemReward แล้ว)

## หน้า

- เช็คอินจุดลงทะเบียน — ใช้ได้จริง (อีเมลเป็น mock)
- เช็คอิน / เพิ่มคน บูธเวิร์คช็อป — UI เสร็จ, ข้อมูล mock
- รายชื่อผู้เข้าร่วมเวิร์คช็อป — UI เสร็จ, ข้อมูล mock
- e2e: e2e/staff-scanner.e2e.ts
- เช็คแลกของที่ระลึก + ประวัติ — รอข้อมูลด้านบน
- เช็คอินบูธนิทรรศการ — คนอื่นทำ

# Placeholder

- ~~ช่องทางข่าวสารงาน (เลือก >=1 หรือ >=0)~~
  ไม่ทันแล้ว
- รางวัล
